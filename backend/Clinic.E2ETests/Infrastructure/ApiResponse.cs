using System.Net;
using FluentAssertions;
using Microsoft.AspNetCore.Mvc;

namespace Clinic.E2ETests.Infrastructure;

public class ApiResponse<T>
{
    public HttpStatusCode StatusCode { get; }
    public T? Data { get; }
    public ProblemDetails? Error { get; }
    public string RawContent { get; }
    public bool IsSuccessStatusCode => (int)StatusCode >= 200 && (int)StatusCode <= 299;

    public ApiResponse(HttpStatusCode statusCode, T? data, ProblemDetails? error, string rawContent)
    {
        StatusCode = statusCode;
        Data = data;
        Error = error;
        RawContent = rawContent;
    }

    public T EnsureSuccess()
    {
        IsSuccessStatusCode.Should().BeTrue($"Expected 2xx but got {StatusCode}: {Error?.Detail ?? RawContent}");
        return Data!;
    }

    public void ShouldBe(HttpStatusCode expected)
    {
        StatusCode.Should().Be(expected, $"Raw response was: {RawContent}");
    }

    public void ShouldBeSuccess()
    {
        IsSuccessStatusCode.Should().BeTrue($"Expected success status code but got {StatusCode}: {RawContent}");
    }

    public void ShouldBeConflict() => ShouldBe(HttpStatusCode.Conflict);
    public void ShouldBeBadRequest() => ShouldBe(HttpStatusCode.BadRequest);
    public void ShouldBeUnauthorized() => ShouldBe(HttpStatusCode.Unauthorized);
    public void ShouldBeForbidden() => ShouldBe(HttpStatusCode.Forbidden);
    public void ShouldBeNotFound() => ShouldBe(HttpStatusCode.NotFound);
}
