using System.Net;
using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.Extensions.DependencyInjection;

namespace Clinic.E2ETests.Infrastructure;

public class InMemoryHttpMessageHandler : HttpMessageHandler
{
    private readonly RequestDelegate _pipeline;
    private readonly IServiceProvider _services;

    public InMemoryHttpMessageHandler(RequestDelegate pipeline, IServiceProvider services)
    {
        _pipeline = pipeline;
        _services = services;
    }

    protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
    {
        // Create a dedicated scope for each HTTP request (matching ASP.NET Core request lifecycle)
        using var scope = _services.CreateScope();

        var context = new DefaultHttpContext
        {
            RequestServices = scope.ServiceProvider
        };

        context.Request.Method = request.Method.Method;
        context.Request.Scheme = request.RequestUri?.Scheme ?? "http";
        context.Request.Host = new HostString(request.RequestUri?.Authority ?? "localhost");
        context.Request.Path = request.RequestUri?.AbsolutePath ?? "/";
        context.Request.QueryString = new QueryString(request.RequestUri?.Query ?? "");

        foreach (var header in request.Headers)
        {
            context.Request.Headers[header.Key] = header.Value.ToArray();
        }

        if (request.Content != null)
        {
            var stream = new MemoryStream();
            await request.Content.CopyToAsync(stream, cancellationToken);
            stream.Seek(0, SeekOrigin.Begin);
            context.Request.Body = stream;
            context.Request.ContentLength = stream.Length;

            if (request.Content.Headers.ContentType != null)
            {
                context.Request.ContentType = request.Content.Headers.ContentType.ToString();
            }

            foreach (var header in request.Content.Headers)
            {
                context.Request.Headers[header.Key] = header.Value.ToArray();
            }

            context.Features.Set<IHttpRequestBodyDetectionFeature>(new DummyRequestBodyDetectionFeature(stream.Length > 0));
        }
        else
        {
            context.Features.Set<IHttpRequestBodyDetectionFeature>(new DummyRequestBodyDetectionFeature(false));
        }

        var responseBody = new MemoryStream();
        context.Response.Body = responseBody;

        try
        {
            await _pipeline(context);
        }
        catch (Exception ex)
        {
            // Catch unhandled exceptions and return 500 InternalServerError
            var errBytes = System.Text.Encoding.UTF8.GetBytes(JsonSerializer.Serialize(new { error = ex.Message }));
            return new HttpResponseMessage(HttpStatusCode.InternalServerError)
            {
                Content = new ByteArrayContent(errBytes)
            };
        }

        responseBody.Seek(0, SeekOrigin.Begin);
        var bytes = responseBody.ToArray();
        var response = new HttpResponseMessage((HttpStatusCode)context.Response.StatusCode)
        {
            Content = new ByteArrayContent(bytes)
        };

        foreach (var header in context.Response.Headers)
        {
            if (!response.Headers.TryAddWithoutValidation(header.Key, header.Value.ToArray()))
            {
                response.Content.Headers.TryAddWithoutValidation(header.Key, header.Value.ToArray());
            }
        }

        if (!string.IsNullOrEmpty(context.Response.ContentType))
        {
            response.Content.Headers.ContentType = System.Net.Http.Headers.MediaTypeHeaderValue.Parse(context.Response.ContentType);
        }

        return response;
    }
}

public class DummyRequestBodyDetectionFeature : IHttpRequestBodyDetectionFeature
{
    public bool CanHaveBody { get; }
    public DummyRequestBodyDetectionFeature(bool canHaveBody) => CanHaveBody = canHaveBody;
}
