param(
    [switch]$InfraOnly   # Pass -InfraOnly to skip app settings update (e.g. first run)
)

$resourceGroup   = "jellingson_group-9d5e"
$subscriptionId  = "ad4f20d3-d2d9-444b-b92b-0d0225fed8c8"
$appServiceName  = "jellingson"
$bicepFile       = "$PSScriptRoot\main.bicep"

Write-Host "Setting subscription..."
az account set --subscription $subscriptionId

Write-Host "Deploying Bicep template..."
$rawOutput = az deployment group create `
    --resource-group $resourceGroup `
    --template-file $bicepFile `
    --query "properties.outputs" `
    --output json

if ($LASTEXITCODE -ne 0) {
    Write-Error "Bicep deployment failed."
    exit 1
}

$output = $rawOutput | ConvertFrom-Json
$storageConn = $output.storageConnectionString.value
$signalRConn  = $output.signalRConnectionString.value

Write-Host "Infrastructure deployed successfully."

if (-not $InfraOnly) {
    Write-Host "Updating App Service settings..."
    az webapp config appsettings set `
        --resource-group $resourceGroup `
        --name $appServiceName `
        --settings `
            "ConnectionStrings__AzureStorage=$storageConn" `
            "Azure__SignalR__ConnectionString=$signalRConn" `
        --output none

    if ($LASTEXITCODE -ne 0) {
        Write-Error "Failed to update App Service settings."
        exit 1
    }

    Write-Host "App Service settings updated."
}

Write-Host "Done."
