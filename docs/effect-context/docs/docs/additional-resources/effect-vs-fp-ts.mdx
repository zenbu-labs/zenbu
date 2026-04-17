---
title: Effect vs fp-ts
description: Comparison of Effect and fp-ts, covering features like typed services, resource management, concurrency, and stream processing.
sidebar:
  order: 4
---

## Key Developments

- **Project Merger**: The fp-ts project is officially merging with the Effect-TS ecosystem. Giulio Canti, the author of fp-ts, is being welcomed into the Effect organization. For more details, see the [announcement here](https://dev.to/effect/a-bright-future-for-effect-455m).
- **Continuity and Evolution**: Effect can be seen as the successor to fp-ts v2 and is effectively fp-ts v3, marking a significant evolution in the library's capabilities.

## FAQ

### Bundle Size Comparison Between Effect and fp-ts

**Q: I compared the bundle sizes of two simple programs using Effect and fp-ts. Why does Effect have a larger bundle size?**

A: It's natural to observe different bundle sizes because Effect and fp-ts are distinct systems designed for different purposes.
Effect's bundle size is larger due to its included fiber runtime, which is crucial for its functionality.
While the initial bundle size may seem large, the overhead amortizes as you use Effect.

**Q: Should I be concerned about the bundle size difference when choosing between Effect and fp-ts?**

A: Not necessarily. Consider the specific requirements and benefits of each library for your project.

The **Micro** module in Effect is designed as a lightweight alternative to the standard `Effect` module, specifically for scenarios where reducing bundle size is crucial.
This module is self-contained and does not include more complex features like `Layer`, `Ref`, `Queue`, and `Deferred`.
If any major Effect modules (beyond basic data modules like `Option`, `Either`, `Array`, etc.) are used, the effect runtime will be added to your bundle, negating the benefits of Micro.
This makes Micro ideal for libraries that aim to implement Effect functionality with minimal impact on bundle size, especially for libraries that plan to expose `Promise`-based APIs.
It also supports scenarios where a client might use Micro while a server uses the full suite of Effect features, maintaining compatibility and shared logic between different parts of an application.

## Comparison Table

The following table compares the features of the Effect and [fp-ts](https://github.com/gcanti/fp-ts) libraries.

| Feature                   | fp-ts | Effect |
| ------------------------- | ----- | ------ |
| Typed Services            | ❌    | ✅     |
| Built-in Services         | ❌    | ✅     |
| Typed errors              | ✅    | ✅     |
| Pipeable APIs             | ✅    | ✅     |
| Dual APIs                 | ❌    | ✅     |
| Testability               | ❌    | ✅     |
| Resource Management       | ❌    | ✅     |
| Interruptions             | ❌    | ✅     |
| Defects                   | ❌    | ✅     |
| Fiber-Based Concurrency   | ❌    | ✅     |
| Fiber Supervision         | ❌    | ✅     |
| Retry and Retry Policies  | ❌    | ✅     |
| Built-in Logging          | ❌    | ✅     |
| Built-in Scheduling       | ❌    | ✅     |
| Built-in Caching          | ❌    | ✅     |
| Built-in Batching         | ❌    | ✅     |
| Metrics                   | ❌    | ✅     |
| Tracing                   | ❌    | ✅     |
| Configuration             | ❌    | ✅     |
| Immutable Data Structures | ❌    | ✅     |
| Stream Processing         | ❌    | ✅     |

Here's an explanation of each feature:

### Typed Services

Both fp-ts and Effect libraries provide the ability to track requirements at the type level, allowing you to define and use services with specific types. In fp-ts, you can utilize the `ReaderTaskEither<R, E, A>` type, while in Effect, the `Effect<A, E, R>` type is available. It's important to note that in fp-ts, the `R` type parameter is contravariant, which means that there is no guarantee of avoiding conflicts, and the library offers only basic tools for dependency management.

On the other hand, in Effect, the `R` type parameter is covariant and all APIs have the ability to merge dependencies at the type level when multiple effects are involved. Effect also provides a range of specifically designed tools to simplify the management of dependencies, including `Tag`, `Context`, and `Layer`. These tools enhance the ease and flexibility of handling dependencies in your code, making it easier to compose and manage complex applications.

### Built-in Services

The Effect library has built-in services like `Clock`, `Random` and `Tracer`, while fp-ts does not provide any default services.

### Typed errors

Both libraries support typed errors, enabling you to define and handle errors with specific types. However, in Effect, all APIs have the ability to merge errors at the type-level when multiple effects are involved, and each effect can potentially fail with different types of errors.

This means that when combining multiple effects that can fail, the resulting type of the error will be a union of the individual error types. Effect provides utilities and type-level operations to handle and manage these merged error types effectively.

### Pipeable APIs

Both fp-ts and Effect libraries provide pipeable APIs, allowing you to compose and sequence operations in a functional and readable manner using the `pipe` function. However, Effect goes a step further and offers a `.pipe()` method on each data type, making it more convenient to work with pipelines without the need to explicitly import the `pipe` function every time.

### Dual APIs

Effect library provides dual APIs, allowing you to use the same API in different ways (e.g., "data-last" and "data-first" variants).

### Testability

The functional style of fp-ts generally promotes good testability of the code written using it, but the library itself does not provide dedicated tools specifically designed for the testing phase. On the other hand, Effect takes testability a step further by offering additional tools that are specifically tailored to simplify the testing process.

Effect provides a range of utilities that improve testability. For example, it offers the `TestClock` utility, which allows you to control the passage of time during tests. This is useful for testing time-dependent code. Additionally, Effect provides the `TestRandom` utility, which enables fully deterministic testing of code that involves randomness. This ensures consistent and predictable test results. Another helpful tool is `ConfigProvider.fromMap`, which makes it easy to define mock configurations for your application during testing.

### Resource Management

The Effect library provides built-in capabilities for resource management, while fp-ts has limited features in this area (mainly `bracket`) and they are less sophisticated.

In Effect, resource management refers to the ability to acquire and release resources, such as database connections, file handles, or network sockets, in a safe and controlled manner. The library offers comprehensive and refined mechanisms to handle resource acquisition and release, ensuring proper cleanup and preventing resource leaks.

### Interruptions

The Effect library supports interruptions, which means you can interrupt and cancel ongoing computations if needed. This feature gives you more control over the execution of your code and allows you to handle situations where you want to stop a computation before it completes.

In Effect, interruptions are useful in scenarios where you need to handle user cancellations, timeouts, or other external events that require stopping ongoing computations. You can explicitly request an interruption and the library will safely and efficiently halt the execution of the computation.

On the other hand, fp-ts does not have built-in support for interruptions. Once a computation starts in fp-ts, it will continue until it completes or encounters an error, without the ability to be interrupted midway.

### Defects

The Effect library provides mechanisms for handling defects and managing **unexpected** failures. In Effect, defects refer to unexpected errors or failures that can occur during the execution of a program.

With the Effect library, you have built-in tools and utilities to handle defects in a structured and reliable manner. It offers error handling capabilities that allow you to catch and handle exceptions, recover from failures, and gracefully handle unexpected scenarios.

On the other hand, fp-ts does not have built-in support specifically dedicated to managing defects. While you can handle errors using standard functional programming techniques in fp-ts, the Effect library provides a more comprehensive and streamlined approach to dealing with defects.

### Fiber-Based Concurrency

The Effect library leverages fiber-based concurrency, which enables lightweight and efficient concurrent computations. In simpler terms, fiber-based concurrency allows multiple tasks to run concurrently, making your code more responsive and efficient.

With fiber-based concurrency, the Effect library can handle concurrent operations in a way that is lightweight and doesn't block the execution of other tasks. This means that you can run multiple computations simultaneously, taking advantage of the available resources and maximizing performance.

On the other hand, fp-ts does not have built-in support for fiber-based concurrency. While fp-ts provides a rich set of functional programming features, it doesn't have the same level of support for concurrent computations as the Effect library.

### Fiber Supervision

Effect library provides supervision strategies for managing and monitoring fibers. fp-ts does not have built-in support for fiber supervision.

### Retry and Retry Policies

The Effect library includes built-in support for retrying computations with customizable retry policies. This feature is not available in fp-ts out of the box, and you would need to rely on external libraries to achieve similar functionality. However, it's important to note that the external libraries may not offer the same level of sophistication and fine-tuning as the built-in retry capabilities provided by the Effect library.

Retry functionality allows you to automatically retry a computation or action when it fails, based on a set of predefined rules or policies. This can be particularly useful in scenarios where you are working with unreliable or unpredictable resources, such as network requests or external services.

The Effect library provides a comprehensive set of retry policies that you can customize to fit your specific needs. These policies define the conditions for retrying a computation, such as the number of retries, the delay between retries, and the criteria for determining if a retry should be attempted.

By leveraging the built-in retry functionality in the Effect library, you can handle transient errors or temporary failures in a more robust and resilient manner. This can help improve the overall reliability and stability of your applications, especially in scenarios where you need to interact with external systems or services.

In contrast, fp-ts does not offer built-in support for retrying computations. If you require retry functionality in fp-ts, you would need to rely on external libraries, which may not provide the same level of sophistication and flexibility as the Effect library.

It's worth noting that the built-in retry capabilities of the Effect library are designed to work seamlessly with its other features, such as error handling and resource management. This integration allows for a more cohesive and comprehensive approach to handling failures and retries within your computations.

### Built-in Logging

The Effect library comes with built-in logging capabilities. This means that you can easily incorporate logging into your applications without the need for additional libraries or dependencies. In addition, the default logger provided by Effect can be replaced with a custom logger to suit your specific logging requirements.

Logging is an essential aspect of software development as it allows you to record and track important information during the execution of your code. It helps you monitor the behavior of your application, debug issues, and gather insights for analysis.

With the built-in logging capabilities of the Effect library, you can easily log messages, warnings, errors, or any other relevant information at various points in your code. This can be particularly useful for tracking the flow of execution, identifying potential issues, or capturing important events during the operation of your application.

On the other hand, fp-ts does not provide built-in logging capabilities. If you need logging functionality in fp-ts, you would need to rely on external libraries or implement your own logging solution from scratch. This can introduce additional complexity and dependencies into your codebase.

### Built-in Scheduling

The Effect library provides built-in scheduling capabilities, which allows you to manage the execution of computations over time. This feature is not available in fp-ts.

In many applications, it's common to have tasks or computations that need to be executed at specific intervals or scheduled for future execution. For example, you might want to perform periodic data updates, trigger notifications, or run background processes at specific times. This is where built-in scheduling comes in handy.

On the other hand, fp-ts does not have built-in scheduling capabilities. If you need to schedule tasks or manage timed computations in fp-ts, you would have to rely on external libraries or implement your own scheduling mechanisms, which can add complexity to your codebase.

### Built-in Caching

The Effect library provides built-in caching mechanisms, which enable you to cache the results of computations for improved performance. This feature is not available in fp-ts.

In many applications, computations can be time-consuming or resource-intensive, especially when dealing with complex operations or accessing remote resources. Caching is a technique used to store the results of computations so that they can be retrieved quickly without the need to recompute them every time.

With the built-in caching capabilities of the Effect library, you can easily cache the results of computations and reuse them when needed. This can significantly improve the performance of your application by avoiding redundant computations and reducing the load on external resources.

### Built-in Batching

The Effect library offers built-in batching capabilities, which enable you to combine multiple computations into a single batched computation. This feature is not available in fp-ts.

In many scenarios, you may need to perform multiple computations that share similar inputs or dependencies. Performing these computations individually can result in inefficiencies and increased overhead. Batching is a technique that allows you to group these computations together and execute them as a single batch, improving performance and reducing unnecessary processing.

### Metrics

The Effect library includes built-in support for collecting and reporting metrics related to computations and system behavior. It specifically supports [OpenTelemetry Metrics](https://opentelemetry.io/docs/specs/otel/metrics/). This feature is not available in fp-ts.

Metrics play a crucial role in understanding and monitoring the performance and behavior of your applications. They provide valuable insights into various aspects, such as response times, resource utilization, error rates, and more. By collecting and analyzing metrics, you can identify performance bottlenecks, optimize your code, and make informed decisions to improve your application's overall quality.

### Tracing

The Effect library has built-in tracing capabilities, which enable you to trace and debug the execution of your code and track the path of a request through an application. Additionally, Effect offers a dedicated [OpenTelemetry exporter](https://opentelemetry.io/docs/instrumentation/js/exporters/) for integrating with the OpenTelemetry observability framework. In contrast, fp-ts does not offer a similar tracing tool to enhance visibility into code execution.

### Configuration

The Effect library provides built-in support for managing and accessing configuration values within your computations. This feature is not available in fp-ts.

Configuration values are an essential aspect of software development. They allow you to customize the behavior of your applications without modifying the code. Examples of configuration values include database connection strings, API endpoints, feature flags, and various settings that can vary between environments or deployments.

With the Effect library's built-in support for configuration, you can easily manage and access these values within your computations. It provides convenient utilities and abstractions to load, validate, and access configuration values, ensuring that your application has the necessary settings it requires to function correctly.

By leveraging the built-in configuration support in the Effect library, you can:

- Load configuration values from various sources such as environment variables, configuration files, or remote configuration providers.
- Validate and ensure that the loaded configuration values adhere to the expected format and structure.
- Access the configuration values within your computations, allowing you to use them wherever necessary.

### Immutable Data Structures

The Effect library provides built-in support for immutable data structures such as `Chunk`, `HashSet`, and `HashMap`. These data structures ensure that once created, their values cannot be modified, promoting safer and more predictable code. In contrast, fp-ts does not have built-in support for such data structures and only provides modules that add additional APIs to standard data types like `Set` and `Map`. While these modules can be useful, they do not offer the same level of performance optimizations and specialized operations as the built-in immutable data structures provided by the Effect library.

Immutable data structures offer several benefits, including:

- Immutability: Immutable data structures cannot be changed after they are created. This property eliminates the risk of accidental modifications and enables safer concurrent programming.

- Predictability: With immutable data structures, you can rely on the fact that their values won't change unexpectedly. This predictability simplifies reasoning about code behavior and reduces bugs caused by mutable state.

- Sharing and Reusability: Immutable data structures can be safely shared between different parts of your program. Since they cannot be modified, you don't need to create defensive copies, resulting in more efficient memory usage and improved performance.

### Stream Processing

The Effect ecosystem provides built-in support for stream processing, enabling you to work with streams of data. Stream processing is a powerful concept that allows you to efficiently process and transform continuous streams of data in a reactive and asynchronous manner. However, fp-ts does not have this feature built-in and relies on external libraries like RxJS to handle stream processing.
