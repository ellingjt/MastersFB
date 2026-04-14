#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo "=== Clean build ==="
rm -rf bin obj publish wwwroot/*

echo "=== Build frontend ==="
cd client
npm run build
cd ..
cp -r client/dist/* wwwroot/

echo "=== Publish backend ==="
dotnet publish -c Release -o ./publish
rm -rf publish/publish 2>/dev/null

echo "=== Package ==="
cd publish
powershell -Command "Compress-Archive -Path ./* -DestinationPath ../deploy.zip -Force"
cd ..

echo "=== Deploy ==="
az webapp deploy \
  --resource-group jellingson_group-9d5e \
  --name jellingson \
  --src-path deploy.zip \
  --type zip \
  --clean true

echo "=== Done ==="
