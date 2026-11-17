using System.Net;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Mvc;

namespace Clinic.E2ETests.Infrastructure;

public class ApiClient
{
    private readonly HttpClient _http;
    private string? _authToken;
    private readonly JsonSerializerOptions _jsonOptions;

    public ApiClient(HttpClient http)
    {
        _http = http;
        _jsonOptions = new JsonSerializerOptions
        {
            PropertyNameCaseInsensitive = true,
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase
        };
        _jsonOptions.Converters.Add(new JsonStringEnumConverter());
    }

    public ApiClient AsDoctor(int userId = 2)
    {
        if (userId == 1) userId = 2;
        return SetToken(TestAuthHelper.DoctorToken(userId));
    }
    public ApiClient AsNurse(int userId = 3) => SetToken(TestAuthHelper.NurseToken(userId));
    public ApiClient AsReceptionist(int userId = 4)
    {
        if (userId == 3) userId = 4;
        return SetToken(TestAuthHelper.ReceptionistToken(userId));
    }
    public ApiClient AsAdmin(int userId = 1) => SetToken(TestAuthHelper.AdminToken(userId));
    public ApiClient AsAssistantDoctor(int userId = 5) => SetToken(TestAuthHelper.AssistantDoctorToken(userId));
    public ApiClient AsAnonymous() => SetToken(null);
    public ApiClient SetToken(string? token) { _authToken = token; return this; }

    public async Task<ApiResponse<T>> GetAsync<T>(string uri)
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, uri);
        ApplyAuth(request);
        using var response = await _http.SendAsync(request);
        return await ParseResponseAsync<T>(response);
    }

    public async Task<ApiResponse<T>> PostAsync<T>(string uri, object? body = null, string? idempotencyKey = null)
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, uri);
        ApplyAuth(request);
        ApplyIdempotency(request, idempotencyKey);
        if (body != null)
        {
            var json = JsonSerializer.Serialize(body, _jsonOptions);
            request.Content = new StringContent(json, Encoding.UTF8, "application/json");
        }
        using var response = await _http.SendAsync(request);
        return await ParseResponseAsync<T>(response);
    }

    public async Task<ApiResponse<T>> PutAsync<T>(string uri, object? body = null, string? idempotencyKey = null)
    {
        using var request = new HttpRequestMessage(HttpMethod.Put, uri);
        ApplyAuth(request);
        ApplyIdempotency(request, idempotencyKey);
        if (body != null)
        {
            var json = JsonSerializer.Serialize(body, _jsonOptions);
            request.Content = new StringContent(json, Encoding.UTF8, "application/json");
        }
        using var response = await _http.SendAsync(request);
        return await ParseResponseAsync<T>(response);
    }

    public async Task<ApiResponse<T>> DeleteAsync<T>(string uri)
    {
        using var request = new HttpRequestMessage(HttpMethod.Delete, uri);
        ApplyAuth(request);
        using var response = await _http.SendAsync(request);
        return await ParseResponseAsync<T>(response);
    }

    public async Task<ApiResponse<T>> PostMultipartAsync<T>(string uri, MultipartFormDataContent form)
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, uri);
        ApplyAuth(request);
        request.Content = form;
        using var response = await _http.SendAsync(request);
        return await ParseResponseAsync<T>(response);
    }

    private void ApplyAuth(HttpRequestMessage request)
    {
        if (!string.IsNullOrEmpty(_authToken))
        {
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _authToken);
        }
    }

    private void ApplyIdempotency(HttpRequestMessage request, string? idempotencyKey)
    {
        var key = idempotencyKey ?? Guid.NewGuid().ToString();
        request.Headers.TryAddWithoutValidation("Idempotency-Key", key);
    }

    private async Task<ApiResponse<T>> ParseResponseAsync<T>(HttpResponseMessage response)
    {
        var rawContent = await response.Content.ReadAsStringAsync();
        T? data = default;
        ProblemDetails? problemDetails = null;

        if (response.IsSuccessStatusCode)
        {
            if (!string.IsNullOrWhiteSpace(rawContent))
            {
                if (typeof(T) == typeof(string))
                {
                    data = (T)(object)rawContent;
                }
                else
                {
                    try
                    {
                        data = JsonSerializer.Deserialize<T>(rawContent, _jsonOptions);
                    }
                    catch
                    {
                        // Fallback if not valid JSON
                    }
                }
            }
        }
        else
        {
            try
            {
                problemDetails = JsonSerializer.Deserialize<ProblemDetails>(rawContent, _jsonOptions);
            }
            catch
            {
                // Raw text error
            }
        }

        return new ApiResponse<T>(response.StatusCode, data, problemDetails, rawContent);
    }
}
