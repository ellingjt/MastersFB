param location string = 'eastus'

@description('Must be globally unique, 3-24 lowercase alphanumeric chars')
param storageAccountName string = 'jellingsonmasters'

@description('Must be globally unique')
param signalRName string = 'jellingson-masters-signalr'

// ---------------------------------------------------------------------------
// Storage Account — Table Storage for chat messages
// ---------------------------------------------------------------------------
resource storageAccount 'Microsoft.Storage/storageAccounts@2023-01-01' = {
  name: storageAccountName
  location: location
  sku: { name: 'Standard_LRS' }
  kind: 'StorageV2'
  properties: {
    accessTier: 'Hot'
    minimumTlsVersion: 'TLS1_2'
    allowBlobPublicAccess: false
  }
}

// ---------------------------------------------------------------------------
// Azure SignalR Service — Free tier (20 connections, 20k messages/day)
// ---------------------------------------------------------------------------
resource signalR 'Microsoft.SignalRService/signalR@2023-02-01' = {
  name: signalRName
  location: location
  sku: {
    name: 'Free_F1'
    tier: 'Free'
    capacity: 1
  }
  kind: 'SignalR'
  properties: {
    features: [
      { flag: 'ServiceMode', value: 'Default' }
    ]
    cors: {
      allowedOrigins: [ '*' ]
    }
  }
}

// ---------------------------------------------------------------------------
// Outputs — picked up by deploy.ps1 to set App Service config
// ---------------------------------------------------------------------------
output storageConnectionString string = 'DefaultEndpointsProtocol=https;AccountName=${storageAccount.name};AccountKey=${storageAccount.listKeys().keys[0].value};EndpointSuffix=core.windows.net'
output signalRConnectionString string = signalR.listKeys().primaryConnectionString
