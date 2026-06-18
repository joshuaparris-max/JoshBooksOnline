param(
    [string]$LocalBooksRoot = $env:LOCAL_BOOKS_ROOT,
    [string]$GoogleClientId = $env:GOOGLE_CLIENT_ID,
    [string]$GoogleClientSecret = $env:GOOGLE_CLIENT_SECRET,
    [string]$GoogleRefreshToken = $env:GOOGLE_REFRESH_TOKEN,
    [string]$LocalBooksFolderName = $env:LOCAL_BOOKS_FOLDER_NAME
)

if (-not $LocalBooksFolderName) {
    $LocalBooksFolderName = 'Local Books'
}

function ThrowIfMissing([string]$name, [string]$value) {
    if (-not $value) {
        throw "Environment variable or parameter `$name is required. Set it and rerun the script."
    }
}

ThrowIfMissing('LOCAL_BOOKS_ROOT', $LocalBooksRoot)
ThrowIfMissing('GOOGLE_CLIENT_ID', $GoogleClientId)
ThrowIfMissing('GOOGLE_CLIENT_SECRET', $GoogleClientSecret)
ThrowIfMissing('GOOGLE_REFRESH_TOKEN', $GoogleRefreshToken)

if (-not (Test-Path -Path $LocalBooksRoot)) {
    throw "Local books root path '$LocalBooksRoot' does not exist."
}

$SupportedExtensions = @{
    '.pdf' = 'application/pdf'
    '.epub' = 'application/epub+zip'
    '.txt' = 'text/plain'
    '.docx' = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
}

function Get-AccessToken {
    Write-Host 'Refreshing Google OAuth access token...'
    $body = @{ 
        client_id = $GoogleClientId
        client_secret = $GoogleClientSecret
        refresh_token = $GoogleRefreshToken
        grant_type = 'refresh_token'
    }

    try {
        $response = Invoke-RestMethod -Method Post -Uri 'https://oauth2.googleapis.com/token' -ContentType 'application/x-www-form-urlencoded' -Body $body
        return $response.access_token
    } catch {
        throw "Failed to refresh access token: $($_.Exception.Message)"
    }
}

function UrlEncode([string]$text) {
    return [System.Uri]::EscapeDataString($text)
}

function Find-FolderId($accessToken, $folderName, $parentId) {
    $escapedName = $folderName -replace "'", "\\'"
    if ($parentId) {
        $query = "name = '$escapedName' and mimeType = 'application/vnd.google-apps.folder' and '$parentId' in parents and trashed = false"
    } else {
        $query = "name = '$escapedName' and mimeType = 'application/vnd.google-apps.folder' and 'me' in owners and trashed = false"
    }
    $uri = "https://www.googleapis.com/drive/v3/files?q=$(UrlEncode($query))&fields=files(id,name)&pageSize=1"
    $headers = @{ Authorization = "Bearer $accessToken" }

    try {
        $result = Invoke-RestMethod -Method Get -Uri $uri -Headers $headers
        if ($result.files -and $result.files.Count -gt 0) {
            return $result.files[0].id
        }
        return $null
    } catch {
        throw "Failed to search for folder '$folderName': $($_.Exception.Message)"
    }
}

function Create-Folder($accessToken, $folderName, $parentId) {
    $body = @{ name = $folderName; mimeType = 'application/vnd.google-apps.folder' }
    if ($parentId) { $body.parents = @($parentId) }
    $headers = @{ Authorization = "Bearer $accessToken" }

    try {
        $json = $body | ConvertTo-Json -Depth 4
        $result = Invoke-RestMethod -Method Post -Uri 'https://www.googleapis.com/drive/v3/files' -Headers $headers -Body $json -ContentType 'application/json'
        return $result.id
    } catch {
        throw "Failed to create folder '$folderName': $($_.Exception.Message)"
    }
}

function Ensure-FolderPath($accessToken, $rootFolderId, $relativePath, [hashtable]$folderCache) {
    if ([string]::IsNullOrWhiteSpace($relativePath)) {
        return $rootFolderId
    }

    $normalized = $relativePath -replace '\\', '/'
    if ($folderCache.ContainsKey($normalized)) {
        return $folderCache[$normalized]
    }

    $currentId = $rootFolderId
    $currentPath = ''
    foreach ($segment in $normalized.Split('/') | Where-Object { -not [string]::IsNullOrWhiteSpace($_) }) {
        if ($currentPath) { $currentPath = "$currentPath/$segment" } else { $currentPath = $segment }

        if ($folderCache.ContainsKey($currentPath)) {
            $currentId = $folderCache[$currentPath]
            continue
        }

        $segmentId = Find-FolderId $accessToken $segment $currentId
        if (-not $segmentId) {
            Write-Host "Creating folder: $currentPath"
            $segmentId = Create-Folder $accessToken $segment $currentId
        }

        $folderCache[$currentPath] = $segmentId
        $currentId = $segmentId
    }

    return $currentId
}

function Find-FileId($accessToken, $fileName, $parentId) {
    $escapedName = $fileName -replace "'", "\\'"
    $query = "name = '$escapedName' and trashed = false and '$parentId' in parents and mimeType != 'application/vnd.google-apps.folder'"
    $uri = "https://www.googleapis.com/drive/v3/files?q=$(UrlEncode($query))&fields=files(id,name,size,modifiedTime)&pageSize=1"
    $headers = @{ Authorization = "Bearer $accessToken" }

    try {
        $result = Invoke-RestMethod -Method Get -Uri $uri -Headers $headers
        if ($result.files -and $result.files.Count -gt 0) {
            return $result.files[0].id
        }
        return $null
    } catch {
        throw "Failed to search for file '$fileName': $($_.Exception.Message)"
    }
}

function Get-MimeType($path) {
    $ext = [System.IO.Path]::GetExtension($path).ToLowerInvariant()
    if ($SupportedExtensions.ContainsKey($ext)) {
        return $SupportedExtensions[$ext]
    }
    return 'application/octet-stream'
}

function Upload-File($accessToken, $localPath, $parentId) {
    $mimeType = Get-MimeType($localPath)
    $fileName = [System.IO.Path]::GetFileName($localPath)
    $metadata = @{ name = $fileName; mimeType = $mimeType; parents = @($parentId) }

    Write-Host "Uploading $localPath -> $fileName"

    $httpClient = [System.Net.Http.HttpClient]::new()
    $httpClient.DefaultRequestHeaders.Authorization = [System.Net.Http.Headers.AuthenticationHeaderValue]::new('Bearer', $accessToken)
    $httpClient.Timeout = [System.TimeSpan]::FromMinutes(20)

    $multipart = [System.Net.Http.MultipartFormDataContent]::new()
    $jsonMetadata = [System.Text.Json.JsonSerializer]::Serialize($metadata)
    $metadataContent = [System.Net.Http.StringContent]::new($jsonMetadata, [System.Text.Encoding]::Utf8, 'application/json')
    $metadataContent.Headers.ContentDisposition = [System.Net.Http.Headers.ContentDispositionHeaderValue]::Parse('form-data; name="metadata"')
    $multipart.Add($metadataContent, 'metadata')

    $fileBytes = [System.IO.File]::ReadAllBytes($localPath)
    $fileContent = [System.Net.Http.ByteArrayContent]::new($fileBytes)
    $fileContent.Headers.ContentType = [System.Net.Http.Headers.MediaTypeHeaderValue]::Parse($mimeType)
    $fileContent.Headers.ContentDisposition = [System.Net.Http.Headers.ContentDispositionHeaderValue]::Parse("form-data; name=\"file\"; filename=\"$fileName\"")
    $multipart.Add($fileContent, 'file', $fileName)

    $uri = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart'
    try {
        $result = $httpClient.PostAsync($uri, $multipart).Result
        $result.EnsureSuccessStatusCode() | Out-Null
        $content = $result.Content.ReadAsStringAsync().Result
        $json = $content | ConvertFrom-Json
        return $json.id
    } catch {
        throw "Failed to upload '$localPath': $($_.Exception.Message)"
    } finally {
        $httpClient.Dispose()
    }
}

$accessToken = Get-AccessToken

Write-Host "Locating or creating Drive folder '$LocalBooksFolderName'..."
$rootFolderId = Find-FolderId $accessToken $LocalBooksFolderName $null
if (-not $rootFolderId) {
    $rootFolderId = Create-Folder $accessToken $LocalBooksFolderName $null
    Write-Host "Created Drive folder '$LocalBooksFolderName' with ID $rootFolderId"
} else {
    Write-Host "Found Drive folder '$LocalBooksFolderName' with ID $rootFolderId"
}

$folderCache = @{}
$folderCache[''] = $rootFolderId

$files = Get-ChildItem -Path $LocalBooksRoot -File -Recurse | Where-Object { $SupportedExtensions.ContainsKey($_.Extension.ToLowerInvariant()) }

if ($files.Count -eq 0) {
    Write-Host "No supported local book files were found under '$LocalBooksRoot'."
    exit 0
}

$uploaded = 0
$skipped = 0
$errors = 0
$total = $files.Count

foreach ($file in $files) {
    try {
        $relativePath = [System.IO.Path]::GetRelativePath($LocalBooksRoot, $file.FullName)
        $folderPath = [System.IO.Path]::GetDirectoryName($relativePath)
        if (-not $folderPath) { $folderPath = '' }

        $parentId = Ensure-FolderPath $accessToken $rootFolderId $folderPath $folderCache
        $existingId = Find-FileId $accessToken $file.Name $parentId

        if ($existingId) {
            Write-Host "Skipping existing file: $relativePath"
            $skipped++
            continue
        }

        Upload-File $accessToken $file.FullName $parentId
        $uploaded++
    } catch {
        Write-Warning "Failed for file '$($file.FullName)': $($_.Exception.Message)"
        $errors++
    }
}

Write-Host "\nSync complete. Total files considered: $total"
Write-Host "Uploaded: $uploaded"
Write-Host "Skipped: $skipped"
Write-Host "Errors: $errors"
