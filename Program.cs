using Azure.Data.Tables;
using MastersScores.Services;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.

builder.Services.AddControllers();
builder.Services.AddApplicationInsightsTelemetry();
builder.Services.AddMemoryCache();
builder.Services.AddSingleton(new TableServiceClient(builder.Configuration.GetConnectionString("AzureStorage")));
builder.Services.AddSingleton<TableStorageService>();
builder.Services.AddHttpClient("masters", client =>
{
    client.DefaultRequestHeaders.Add("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36");
    client.DefaultRequestHeaders.Add("Accept", "application/json, text/plain, */*");
    client.DefaultRequestHeaders.Add("Referer", "https://www.masters.com/");
});
// Learn more about configuring Swagger/OpenAPI at https://aka.ms/aspnetcore/swashbuckle
builder.Services.AddSignalR().AddAzureSignalR();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

var app = builder.Build();

// Ensure Table Storage tables exist
await app.Services.GetRequiredService<TableStorageService>().InitializeAsync();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();

app.UseDefaultFiles();
app.UseStaticFiles();

app.UseAuthorization();

app.MapControllers();
app.MapHub<MastersScores.Hubs.ChatHub>("/hubs/chat");

// SPA fallback: serve index.html for non-API, non-file routes
app.MapFallbackToFile("index.html");

app.Run();
