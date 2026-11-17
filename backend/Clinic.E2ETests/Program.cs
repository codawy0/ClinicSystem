using System.Diagnostics;
using System.Reflection;
using Clinic.E2ETests.Fixtures;
using Clinic.E2ETests.Infrastructure;
using Xunit;

namespace Clinic.E2ETests;

public class TestFilterCriteria
{
    public string? Tier { get; set; }
    public string? Category { get; set; }
    public string? Method { get; set; }
    public string? Stage { get; set; }

    public static TestFilterCriteria Parse(string[] args)
    {
        var criteria = new TestFilterCriteria();

        for (int i = 0; i < args.Length; i++)
        {
            var raw = args[i].Trim('\"', '\'');

            // 1. Flag: --tier <N> or -t <N>
            if ((string.Equals(raw, "--tier", StringComparison.OrdinalIgnoreCase) ||
                 string.Equals(raw, "-t", StringComparison.OrdinalIgnoreCase)) && i + 1 < args.Length)
            {
                criteria.Tier = args[++i].Trim('\"', '\'');
                continue;
            }

            // 2. Flag: --category <Cat> or -c <Cat>
            if ((string.Equals(raw, "--category", StringComparison.OrdinalIgnoreCase) ||
                 string.Equals(raw, "-c", StringComparison.OrdinalIgnoreCase)) && i + 1 < args.Length)
            {
                criteria.Category = args[++i].Trim('\"', '\'');
                continue;
            }

            // 3. Flag: --method <Name> or -m <Name>
            if ((string.Equals(raw, "--method", StringComparison.OrdinalIgnoreCase) ||
                 string.Equals(raw, "-m", StringComparison.OrdinalIgnoreCase)) && i + 1 < args.Length)
            {
                criteria.Method = args[++i].Trim('\"', '\'');
                continue;
            }

            // 4. Flag: --stage <N> or -s <N>
            if ((string.Equals(raw, "--stage", StringComparison.OrdinalIgnoreCase) ||
                 string.Equals(raw, "-s", StringComparison.OrdinalIgnoreCase)) && i + 1 < args.Length)
            {
                criteria.Stage = args[++i].Trim('\"', '\'');
                continue;
            }

            if (string.Equals(raw, "--implemented", StringComparison.OrdinalIgnoreCase))
            {
                criteria.Stage = "1";
                continue;
            }

            // 5. Combined --filter flag: --filter "Category=E2E&Tier=2" or --filter=...
            if (raw.StartsWith("--filter=", StringComparison.OrdinalIgnoreCase))
            {
                ParseFilterExpression(raw.Substring("--filter=".Length), criteria);
                continue;
            }

            if (string.Equals(raw, "--filter", StringComparison.OrdinalIgnoreCase) && i + 1 < args.Length)
            {
                ParseFilterExpression(args[++i], criteria);
                continue;
            }

            // 6. Direct clause expressions: Tier=2, Category=E2E, Stage=1, FullyQualifiedName~...
            if (raw.Contains('=') || raw.Contains('~'))
            {
                ParseFilterExpression(raw, criteria);
                continue;
            }
        }

        return criteria;
    }

    private static void ParseFilterExpression(string expr, TestFilterCriteria criteria)
    {
        var clauses = expr.Split(new[] { '&', ';', '|' }, StringSplitOptions.RemoveEmptyEntries);
        foreach (var clause in clauses)
        {
            var trimmed = clause.Trim('\"', '\'', ' ');

            var tierMatch = System.Text.RegularExpressions.Regex.Match(trimmed, @"(?:--tier=?|Tier=)([0-9]+)", System.Text.RegularExpressions.RegexOptions.IgnoreCase);
            if (tierMatch.Success)
            {
                criteria.Tier = tierMatch.Groups[1].Value;
                continue;
            }

            var catMatch = System.Text.RegularExpressions.Regex.Match(trimmed, @"(?:--category=?|Category=)([a-zA-Z0-9_\-]+)", System.Text.RegularExpressions.RegexOptions.IgnoreCase);
            if (catMatch.Success)
            {
                criteria.Category = catMatch.Groups[1].Value;
                continue;
            }

            var stageMatch = System.Text.RegularExpressions.Regex.Match(trimmed, @"(?:--stage=?|Stage=)([0-9]+)", System.Text.RegularExpressions.RegexOptions.IgnoreCase);
            if (stageMatch.Success)
            {
                criteria.Stage = stageMatch.Groups[1].Value;
                continue;
            }

            var methodMatch = System.Text.RegularExpressions.Regex.Match(trimmed, @"(?:FullyQualifiedName~|Method=)([a-zA-Z0-9_]+)", System.Text.RegularExpressions.RegexOptions.IgnoreCase);
            if (methodMatch.Success)
            {
                criteria.Method = methodMatch.Groups[1].Value;
                continue;
            }
        }
    }
}

public static class Program
{
    public static int GetClassStage(Type t)
    {
        var traits = CustomAttributeData.GetCustomAttributes(t)
            .Where(a => a.AttributeType == typeof(TraitAttribute) && a.ConstructorArguments.Count >= 2)
            .ToDictionary(a => a.ConstructorArguments[0].Value?.ToString() ?? "", a => a.ConstructorArguments[1].Value?.ToString() ?? "");

        if (traits.TryGetValue("Stage", out var sStr) && int.TryParse(sStr, out var s)) return s;

        if (traits.TryGetValue("Feature", out var feat))
        {
            if (feat is "F01" or "F02" or "F03" or "F04" or "F05" or "F06" or "F07" or "F08" or "F09" or "F10") return 1;
            if (feat is "F11" or "F12" or "F13" or "F14") return 2;
            if (feat is "F15" or "F16") return 3;
        }

        var name = t.Name;
        if (name.Contains("T1_01") || name.Contains("T1_02") || name.Contains("T1_03") || name.Contains("T1_04") ||
            name.Contains("T1_05") || name.Contains("T1_06") || name.Contains("T1_07") || name.Contains("T1_08") ||
            name.Contains("T1_09") || name.Contains("T1_10")) return 1;

        if (name.Contains("T2_01") || name.Contains("T2_02") || name.Contains("T2_03") || name.Contains("T2_04") ||
            name.Contains("T2_05") || name.Contains("T2_06") || name.Contains("T2_07") || name.Contains("T2_08") ||
            name.Contains("T2_09") || name.Contains("T2_10")) return 1;

        if (name.Contains("T3_01") || name.Contains("T3_02") || name.Contains("T3_03") ||
            name.Contains("T3_08") || name.Contains("T3_12")) return 1;

        if (name.Contains("T4_02")) return 1;

        if (name.Contains("T1_15") || name.Contains("T1_16") || name.Contains("T2_15") || name.Contains("T2_16") ||
            name.Contains("T3_09") || name.Contains("F15") || name.Contains("F16") || name.Contains("Ledger") ||
            name.Contains("Backup") || name.Contains("Analytics")) return 3;

        return 2;
    }

    public static int GetMethodStage(MethodInfo method, Type testClass)
    {
        var traits = CustomAttributeData.GetCustomAttributes(method)
            .Where(a => a.AttributeType == typeof(TraitAttribute) && a.ConstructorArguments.Count >= 2)
            .ToDictionary(
                a => a.ConstructorArguments[0].Value?.ToString() ?? "", 
                a => a.ConstructorArguments[1].Value?.ToString() ?? "", 
                StringComparer.OrdinalIgnoreCase);

        // 1. Direct method-level Stage trait
        if (traits.TryGetValue("Stage", out var sStr) && int.TryParse(sStr, out var s)) return s;

        // 2. Direct method-level Phase trait (Phase 4 -> Stage 3; Phase 3 -> Stage 2)
        if (traits.TryGetValue("Phase", out var pStr) && int.TryParse(pStr, out var p))
        {
            if (p <= 2) return 1;
            if (p == 3) return 2;
            if (p >= 4) return 3;
        }

        // 3. Direct method-level Feature trait
        if (traits.TryGetValue("Feature", out var feat))
        {
            if (feat is "F01" or "F02" or "F03" or "F04" or "F05" or "F06" or "F07" or "F08" or "F09" or "F10") return 1;
            if (feat is "F11" or "F12" or "F13" or "F14") return 2;
            if (feat is "F15" or "F16") return 3;
        }

        // 4. Method naming conventions for Phase 4 / Phase 3 staging
        if (method.Name.Contains("_P4_") || method.Name.Contains("Phase4") ||
            (testClass.Name.Contains("T2_03") && (method.Name.Contains("PayInvoice") || method.Name.Contains("PaymentExceedingRemaining") || method.Name.Contains("ZeroPaymentAmount"))))
        {
            return 3; // Phase 4 Treasury Ledger
        }

        // 5. Fallback to class-level stage
        return GetClassStage(testClass);
    }

    public static async Task<int> Main(string[] args)
    {
        Console.WriteLine("===============================================================================");
        Console.WriteLine("Clinic Management System - E2E Comprehensive Test Suite Runner");
        Console.WriteLine("===============================================================================");

        var criteria = TestFilterCriteria.Parse(args);

        var assembly = typeof(Program).Assembly;
        var testClasses = assembly.GetTypes()
            .Where(t => t.IsClass && !t.IsAbstract)
            .Where(t =>
            {
                var traits = CustomAttributeData.GetCustomAttributes(t)
                    .Where(a => a.AttributeType == typeof(TraitAttribute) && a.ConstructorArguments.Count >= 2)
                    .Select(a => (Name: a.ConstructorArguments[0].Value?.ToString(), Value: a.ConstructorArguments[1].Value?.ToString()))
                    .ToList();

                if (criteria.Category != null && !traits.Any(a => string.Equals(a.Name, "Category", StringComparison.OrdinalIgnoreCase) && string.Equals(a.Value, criteria.Category, StringComparison.OrdinalIgnoreCase)))
                    return false;
                if (criteria.Tier != null && !traits.Any(a => string.Equals(a.Name, "Tier", StringComparison.OrdinalIgnoreCase) && string.Equals(a.Value, criteria.Tier, StringComparison.OrdinalIgnoreCase)))
                    return false;

                if (criteria.Method != null && !t.Name.Contains(criteria.Method, StringComparison.OrdinalIgnoreCase))
                {
                    var hasMatchingMethod = t.GetMethods(BindingFlags.Public | BindingFlags.Instance)
                        .Any(m => m.GetCustomAttribute<FactAttribute>() != null && m.Name.Contains(criteria.Method, StringComparison.OrdinalIgnoreCase));
                    if (!hasMatchingMethod) return false;
                }

                // Stage filter check: class matches if it has ANY methods matching the stage criteria
                if (criteria.Stage != null)
                {
                    var hasMatchingStageMethod = t.GetMethods(BindingFlags.Public | BindingFlags.Instance)
                        .Where(m => m.GetCustomAttribute<FactAttribute>() != null)
                        .Any(m => GetMethodStage(m, t).ToString() == criteria.Stage);
                    if (!hasMatchingStageMethod) return false;
                }

                return traits.Any(a => a.Name == "Category" && a.Value == "E2E");
            })
            .OrderBy(t => t.Name)
            .ToList();

        Console.WriteLine($"Discovered {testClasses.Count} matching test classes (Filters: Category={criteria.Category ?? "Any"}, Tier={criteria.Tier ?? "Any"}, Stage={criteria.Stage ?? "Any"}, Method={criteria.Method ?? "Any"}).\n");

        int totalTests = 0;
        int passedTests = 0;
        int failedTests = 0;
        int stagedTests = 0;
        var failedList = new List<(string Name, Exception Ex)>();

        var totalStopwatch = Stopwatch.StartNew();

        foreach (var testClass in testClasses)
        {
            var testMethods = testClass.GetMethods(BindingFlags.Public | BindingFlags.Instance)
                .Where(m => m.GetCustomAttribute<FactAttribute>() != null)
                .Where(m => criteria.Method == null || m.Name.Contains(criteria.Method, StringComparison.OrdinalIgnoreCase) || testClass.Name.Contains(criteria.Method, StringComparison.OrdinalIgnoreCase))
                .ToList();

            if (testMethods.Count == 0) continue;

            // Partition into runnable vs staged
            var runnableMethods = new List<MethodInfo>();
            var stagedMethodsInClass = new List<(MethodInfo Method, int Stage)>();

            foreach (var m in testMethods)
            {
                var mStage = GetMethodStage(m, testClass);
                if (criteria.Stage != null)
                {
                    if (mStage.ToString() == criteria.Stage)
                        runnableMethods.Add(m);
                }
                else
                {
                    // Full un-staged sweep: Stage 1 runs, Stage > 1 is staged
                    if (mStage > 1)
                        stagedMethodsInClass.Add((m, mStage));
                    else
                        runnableMethods.Add(m);
                }
            }

            // Case A: Entire class is staged (e.g. Phase 3 / Phase 4 classes during full sweep)
            if (runnableMethods.Count == 0 && stagedMethodsInClass.Count > 0)
            {
                var phaseNum = stagedMethodsInClass.Max(x => x.Stage) + 1;
                Console.WriteLine($"--> [{testClass.Name}] ({testMethods.Count} tests) [STAGED FOR PHASE {phaseNum}]");
                foreach (var (m, s) in stagedMethodsInClass)
                {
                    totalTests++;
                    stagedTests++;
                    Console.WriteLine($"    [STAGED] {m.Name} (Pending implementation of Phase {s + 1})");
                }
                continue;
            }

            if (runnableMethods.Count == 0) continue;

            // Case B: Has runnable methods (and possibly some staged methods)
            Console.WriteLine($"--> [{testClass.Name}] ({testMethods.Count} tests)");

            // Report any staged methods in this class first
            foreach (var (m, s) in stagedMethodsInClass)
            {
                totalTests++;
                stagedTests++;
                Console.WriteLine($"    [STAGED] {m.Name} (Pending implementation of Phase {s + 1})");
            }

            // Initialize fixture and execute runnable methods
            var fixture = new ClinicTestFixture();
            await fixture.InitializeAsync();

            try
            {
                foreach (var method in runnableMethods)
                {
                    totalTests++;
                    var sw = Stopwatch.StartNew();

                    object instance;
                    var ctor = testClass.GetConstructor(new[] { typeof(ClinicTestFixture) });
                    if (ctor != null)
                    {
                        instance = ctor.Invoke(new object[] { fixture });
                    }
                    else
                    {
                        instance = Activator.CreateInstance(testClass)!;
                    }

                    try
                    {
                        var result = method.Invoke(instance, null);
                        if (result is Task task)
                        {
                            await task;
                        }

                        sw.Stop();
                        passedTests++;
                        Console.WriteLine($"    [PASS] {method.Name} ({sw.ElapsedMilliseconds} ms)");
                    }
                    catch (Exception ex)
                    {
                        sw.Stop();
                        failedTests++;
                        var inner = ex is TargetInvocationException tie ? tie.InnerException ?? ex : ex;
                        failedList.Add(($"{testClass.Name}.{method.Name}", inner));
                        Console.WriteLine($"    [FAIL] {method.Name} ({sw.ElapsedMilliseconds} ms)");
                        Console.WriteLine($"           Error: {inner.Message}");
                    }
                    finally
                    {
                        if (instance is IAsyncDisposable asyncDisp)
                        {
                            await asyncDisp.DisposeAsync();
                        }
                        else if (instance is IDisposable disp)
                        {
                            disp.Dispose();
                        }
                    }
                }
            }
            finally
            {
                await fixture.DisposeAsync();
            }
        }

        totalStopwatch.Stop();

        Console.WriteLine("\n===============================================================================");
        Console.WriteLine($"Test Execution Summary (Duration: {totalStopwatch.Elapsed.TotalSeconds:F2}s)");
        Console.WriteLine($"Total: {totalTests} | Passed: {passedTests} | Failed: {failedTests} | Staged: {stagedTests}");
        Console.WriteLine("===============================================================================");

        if (failedTests > 0)
        {
            Console.WriteLine("\nFailures:");
            foreach (var (name, ex) in failedList)
            {
                Console.WriteLine($"- {name}: {ex.Message}");
                Console.WriteLine($"  {ex.StackTrace?.Split('\n').FirstOrDefault()?.Trim()}");
            }
            return 1;
        }

        Console.WriteLine("\nALL EXECUTED TESTS PASSED SUCCESSFULLY!");
        return 0;
    }
}
