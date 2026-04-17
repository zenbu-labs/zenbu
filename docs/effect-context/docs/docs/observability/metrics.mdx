---
title: Metrics in Effect
description: Effect Metrics provides powerful monitoring tools, including counters, gauges, histograms, summaries, and frequencies, to track your application's performance and behavior.
sidebar:
  label: Metrics
  order: 1
---

import { Aside } from "@astrojs/starlight/components"

In complex and highly concurrent applications, managing various interconnected components can be quite challenging. Ensuring that everything runs smoothly and avoiding application downtime becomes crucial in such setups.

Now, let's imagine we have a sophisticated infrastructure with numerous services. These services are replicated and distributed across our servers. However, we often lack insight into what's happening across these services, including error rates, response times, and service uptime. This lack of visibility can make it challenging to identify and address issues effectively. This is where Effect Metrics comes into play; it allows us to capture and analyze various metrics, providing valuable data for later investigation.

Effect Metrics offers support for five different types of metrics:

| Metric        | Description                                                                                                                                                                                                                                                             |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Counter**   | Counters are used to track values that increase over time, such as request counts. They help us keep tabs on how many times a specific event or action has occurred.                                                                                                    |
| **Gauge**     | Gauges represent a single numerical value that can fluctuate up and down over time. They are often used to monitor metrics like memory usage, which can vary continuously.                                                                                              |
| **Histogram** | Histograms are useful for tracking the distribution of observed values across different buckets. They are commonly used for metrics like request latencies, allowing us to understand how response times are distributed.                                               |
| **Summary**   | Summaries provide insight into a sliding window of a time series and offer metrics for specific percentiles of the time series, often referred to as quantiles. This is particularly helpful for understanding latency-related metrics, such as request response times. |
| **Frequency** | Frequency metrics count the occurrences of distinct string values. They are useful when you want to keep track of how often different events or conditions are happening in your application.                                                                           |

## Counter

In the world of metrics, a Counter is a metric that represents a single numerical value that can be both incremented and decremented over time. Think of it like a tally that keeps track of changes, such as the number of a particular type of request received by your application, whether it's increasing or decreasing.

Unlike some other types of metrics (like [gauges](#gauge)), where we're interested in the value at a specific moment, with counters, we care about the cumulative value over time. This means it provides a running total of changes, which can go up and down, reflecting the dynamic nature of certain metrics.

Some typical use cases for counters include:

- **Request Counts**: Monitoring the number of incoming requests to your server.
- **Completed Tasks**: Keeping track of how many tasks or processes have been successfully completed.
- **Error Counts**: Counting the occurrences of errors in your application.

### How to Create a Counter

To create a counter, you can use the `Metric.counter` constructor.

**Example** (Creating a Counter)

```ts twoslash
import { Metric, Effect } from "effect"

const requestCount = Metric.counter("request_count", {
  // Optional
  description: "A counter for tracking requests"
})
```

Once created, the counter can accept an effect that returns a `number`, which will increment or decrement the counter.

**Example** (Using a Counter)

```ts twoslash
import { Metric, Effect } from "effect"

const requestCount = Metric.counter("request_count")

const program = Effect.gen(function* () {
  // Increment the counter by 1
  const a = yield* requestCount(Effect.succeed(1))
  // Increment the counter by 2
  const b = yield* requestCount(Effect.succeed(2))
  // Decrement the counter by 4
  const c = yield* requestCount(Effect.succeed(-4))

  // Get the current state of the counter
  const state = yield* Metric.value(requestCount)
  console.log(state)

  return a * b * c
})

Effect.runPromise(program).then(console.log)
/*
Output:
CounterState {
  count: -1,
  ...
}
-8
*/
```

<Aside type="note" title="Type Preservation">
  Applying a counter to an effect doesn't change its original type. The
  metric simply adds tracking without affecting the effect's output type.
</Aside>

### Counter Types

You can specify whether the counter tracks a `number` or `bigint`.

```ts twoslash
import { Metric } from "effect"

const numberCounter = Metric.counter("request_count", {
  description: "A counter for tracking requests"
  // bigint: false // default
})

const bigintCounter = Metric.counter("error_count", {
  description: "A counter for tracking errors",
  bigint: true
})
```

### Increment-Only Counters

If you need a counter that only increments, you can use the `incremental: true` option.

**Example** (Using an Increment-Only Counter)

```ts twoslash
import { Metric, Effect } from "effect"

const incrementalCounter = Metric.counter("count", {
  description: "a counter that only increases its value",
  incremental: true
})

const program = Effect.gen(function* () {
  const a = yield* incrementalCounter(Effect.succeed(1))
  const b = yield* incrementalCounter(Effect.succeed(2))
  // This will have no effect on the counter
  const c = yield* incrementalCounter(Effect.succeed(-4))

  const state = yield* Metric.value(incrementalCounter)
  console.log(state)

  return a * b * c
})

Effect.runPromise(program).then(console.log)
/*
Output:
CounterState {
  count: 3,
  ...
}
-8
*/
```

In this configuration, the counter only accepts positive values. Any attempts to decrement will have no effect, ensuring the counter strictly counts upwards.

### Counters With Constant Input

You can configure a counter to always increment by a fixed value each time it is invoked.

**Example** (Constant Input)

```ts twoslash
import { Metric, Effect } from "effect"

const taskCount = Metric.counter("task_count").pipe(
  Metric.withConstantInput(1) // Automatically increments by 1
)

const task1 = Effect.succeed(1).pipe(Effect.delay("100 millis"))
const task2 = Effect.succeed(2).pipe(Effect.delay("200 millis"))
const task3 = Effect.succeed(-4).pipe(Effect.delay("300 millis"))

const program = Effect.gen(function* () {
  const a = yield* taskCount(task1)
  const b = yield* taskCount(task2)
  const c = yield* taskCount(task3)

  const state = yield* Metric.value(taskCount)
  console.log(state)

  return a * b * c
})

Effect.runPromise(program).then(console.log)
/*
Output:
CounterState {
  count: 3,
  ...
}
-8
*/
```

## Gauge

In the world of metrics, a Gauge is a metric that represents a single numerical value that can be set or adjusted. Think of it as a dynamic variable that can change over time. One common use case for a gauge is to monitor something like the current memory usage of your application.

Unlike counters, where we're interested in cumulative values over time, with gauges, our focus is on the current value at a specific point in time.

Gauges are the best choice when you want to monitor values that can both increase and decrease, and you're not interested in tracking their rates of change. In other words, gauges help us measure things that have a specific value at a particular moment.

Some typical use cases for gauges include:

- **Memory Usage**: Keeping an eye on how much memory your application is using right now.
- **Queue Size**: Monitoring the current size of a queue where tasks are waiting to be processed.
- **In-Progress Request Counts**: Tracking the number of requests currently being handled by your server.
- **Temperature**: Measuring the current temperature, which can fluctuate up and down.

### How to Create a Gauge

To create a gauge, you can use the `Metric.gauge` constructor.

**Example** (Creating a Gauge)

```ts twoslash
import { Metric } from "effect"

const memory = Metric.gauge("memory_usage", {
  // Optional
  description: "A gauge for memory usage"
})
```

Once created, a gauge can be updated by passing an effect that produces the value you want to set for the gauge.

**Example** (Using a Gauge)

```ts twoslash
import { Metric, Effect, Random } from "effect"

// Create a gauge to track temperature
const temperature = Metric.gauge("temperature")

// Simulate fetching a random temperature
const getTemperature = Effect.gen(function* () {
  // Get a random temperature between -10 and 10
  const t = yield* Random.nextIntBetween(-10, 10)
  console.log(`new temperature: ${t}`)
  return t
})

// Program that updates the gauge multiple times
const program = Effect.gen(function* () {
  const series: Array<number> = []
  // Update the gauge with new temperature readings
  series.push(yield* temperature(getTemperature))
  series.push(yield* temperature(getTemperature))
  series.push(yield* temperature(getTemperature))

  // Retrieve the current state of the gauge
  const state = yield* Metric.value(temperature)
  console.log(state)

  return series
})

Effect.runPromise(program).then(console.log)
/*
Example Output:
new temperature: 9
new temperature: -9
new temperature: 2
GaugeState {
  value: 2, // the most recent value set in the gauge
  ...
}
[ 9, -9, 2 ]
*/
```

<Aside type="note" title="Gauge Behavior">
  Gauges capture the most recent value set, so if you're tracking a
  sequence of updates, the final state will show only the last recorded
  value, not the entire series.
</Aside>

### Gauge Types

You can specify whether the gauge tracks a `number` or `bigint`.

```ts twoslash
import { Metric } from "effect"

const numberGauge = Metric.gauge("memory_usage", {
  description: "A gauge for memory usage"
  // bigint: false // default
})

const bigintGauge = Metric.gauge("cpu_load", {
  description: "A gauge for CPU load",
  bigint: true
})
```

## Histogram

A Histogram is a metric used to analyze how numerical values are distributed over time. Instead of focusing on individual data points, a histogram groups values into predefined ranges, called **buckets**, and tracks how many values fall into each range.

When a value is recorded, it gets assigned to one of the histogram's buckets based on its range. Each bucket has an upper boundary, and the count for that bucket is increased if the value is less than or equal to its boundary. Once recorded, the individual value is discarded, and the focus shifts to how many values have fallen into each bucket.

Histograms also track:

- **Total Count**: The number of values that have been observed.
- **Sum**: The sum of all the observed values.
- **Min**: The smallest observed value.
- **Max**: The largest observed value.

Histograms are especially useful for calculating percentiles, which can help you estimate specific points in a dataset by analyzing how many values are in each bucket.

This concept is inspired by [Prometheus](https://prometheus.io/docs/concepts/metric_types#histogram), a well-known monitoring and alerting toolkit.

Histograms are particularly useful in performance analysis and system monitoring. By examining how response times, latencies, or other metrics are distributed, you can gain valuable insights into your system's behavior. This data helps you identify outliers, performance bottlenecks, or trends that may require optimization.

Common use cases for histograms include:

- **Percentile Estimation**: Histograms allow you to approximate percentiles of observed values, like the 95th percentile of response times.
- **Known Ranges**: If you can estimate the range of values in advance, histograms can organize the data into predefined buckets for better analysis.
- **Performance Metrics**: Use histograms to track metrics like request latencies, memory usage, or throughput over time.
- **Aggregation**: Histograms can be aggregated across multiple instances, making them ideal for distributed systems where you need to collect data from different sources.

<Aside type="note" title="Histogram Buckets and Precision">
  Keep in mind that histograms don't retain exact values. Instead, they
  group values into buckets, so the precision of your data depends on how
  you define these buckets.
</Aside>

**Example** (Histogram With Linear Buckets)

In this example, we define a histogram with linear buckets, where the values range from `0` to `100` in increments of `10`. Additionally, we include a final bucket for values greater than `100`, referred to as the "Infinity" bucket. This configuration is useful for tracking numeric values, like request latencies, within specific ranges.

The program generates random numbers between `1` and `120`, records them in the histogram, and then prints the histogram's state, showing the count of values that fall into each bucket.

```ts twoslash
import { Effect, Metric, MetricBoundaries, Random } from "effect"

// Define a histogram to track request latencies, with linear buckets
const latency = Metric.histogram(
  "request_latency",
  // Buckets from 0-100, with an extra Infinity bucket
  MetricBoundaries.linear({ start: 0, width: 10, count: 11 }),
  // Optional
  "Measures the distribution of request latency."
)

const program = Effect.gen(function* () {
  // Generate 100 random values and record them in the histogram
  yield* latency(Random.nextIntBetween(1, 120)).pipe(Effect.repeatN(99))

  // Fetch and display the histogram's state
  const state = yield* Metric.value(latency)
  console.log(state)
})

Effect.runPromise(program)
/*
Example Output:
HistogramState {
  buckets: [
    [ 0, 0 ],    // No values in the 0-10 range
    [ 10, 7 ],   // 7 values in the 10-20 range
    [ 20, 11 ],  // 4 values in the 20-30 range
    [ 30, 20 ],  // 9 values in the 30-40 range
    [ 40, 27 ],  // and so on...
    [ 50, 38 ],
    [ 60, 53 ],
    [ 70, 64 ],
    [ 80, 73 ],
    [ 90, 84 ],
    [ Infinity, 100 ] // All 100 values have been recorded
  ],
  count: 100,  // Total count of observed values
  min: 1,      // Smallest observed value
  max: 119,    // Largest observed value
  sum: 5980,   // Sum of all observed values
  ...
}
*/
```

### Timer Metric

In this example, we demonstrate how to use a timer metric to track the duration of specific workflows. The timer captures how long certain tasks take to execute, storing this information in a histogram, which provides insights into the distribution of these durations.

We generate random values to simulate varying wait times, record the durations in the timer, and then print out the histogram's state.

**Example** (Tracking Workflow Durations with a Timer Metric)

```ts twoslash
import { Metric, Array, Random, Effect } from "effect"

// Create a timer metric with predefined boundaries from 1 to 10
const timer = Metric.timerWithBoundaries("timer", Array.range(1, 10))

// Define a task that simulates random wait times
const task = Effect.gen(function* () {
  // Generate a random value between 1 and 10
  const n = yield* Random.nextIntBetween(1, 10)
  // Simulate a delay based on the random value
  yield* Effect.sleep(`${n} millis`)
})

const program = Effect.gen(function* () {
  // Track the duration of the task and repeat it 100 times
  yield* Metric.trackDuration(task, timer).pipe(Effect.repeatN(99))

  // Retrieve and print the current state of the timer histogram
  const state = yield* Metric.value(timer)
  console.log(state)
})

Effect.runPromise(program)
/*
Example Output:
HistogramState {
  buckets: [
    [ 1, 3 ],   // 3 tasks completed in <= 1 ms
    [ 2, 13 ],  // 10 tasks completed in <= 2 ms
    [ 3, 17 ],  // and so on...
    [ 4, 26 ],
    [ 5, 35 ],
    [ 6, 43 ],
    [ 7, 53 ],
    [ 8, 56 ],
    [ 9, 65 ],
    [ 10, 72 ],
    [ Infinity, 100 ]      // All 100 tasks have completed
  ],
  count: 100,              // Total number of tasks observed
  min: 0.25797,            // Shortest task duration in milliseconds
  max: 12.25421,           // Longest task duration in milliseconds
  sum: 683.0266810000002,  // Total time spent across all tasks
  ...
}
*/
```

## Summary

A Summary is a metric that gives insights into a series of data points by calculating specific percentiles. Percentiles help us understand how data is distributed. For instance, if you're tracking response times for requests over the past hour, you may want to examine key percentiles such as the 50th, 90th, 95th, or 99th to better understand your system's performance.

Summaries are similar to histograms in that they observe `number` values, but with a different approach. Instead of immediately sorting values into buckets and discarding them, a summary holds onto the observed values in memory. However, to avoid storing too much data, summaries use two parameters:

- **maxAge**: The maximum age a value can have before it's discarded.
- **maxSize**: The maximum number of values stored in the summary.

This creates a sliding window of recent values, so the summary always represents a fixed number of the most recent observations.

Summaries are commonly used to calculate **quantiles** over this sliding window. A **quantile** is a number between `0` and `1` that represents the percentage of values less than or equal to a certain threshold. For example, a quantile of `0.5` (or 50th percentile) is the **median** value, while `0.95` (or 95th percentile) would represent the value below which 95% of the observed data falls.

Quantiles are helpful for monitoring important performance metrics, such as latency, and for ensuring that your system meets performance goals (like Service Level Agreements, or SLAs).

The Effect Metrics API also allows you to configure summaries with an **error margin**. This margin introduces a range of acceptable values for quantiles, improving the accuracy of the result.

Summaries are particularly useful in cases where:

- The range of values you're observing is not known or estimated in advance, making histograms less practical.
- You don't need to aggregate data across multiple instances or average results. Summaries calculate their results on the application side, meaning they focus on the specific instance where they are used.

**Example** (Creating and Using a Summary)

In this example, we will create a summary to track response times. The summary will:

- Hold up to `100` samples.
- Discard samples older than `1 day`.
- Have a `3%` error margin when calculating quantiles.
- Report the `10%`, `50%`, and `90%` quantiles, which help track response time distributions.

We'll apply the summary to an effect that generates random integers, simulating response times.

```ts twoslash
import { Metric, Random, Effect } from "effect"

// Define the summary for response times
const responseTimeSummary = Metric.summary({
  name: "response_time_summary", // Name of the summary metric
  maxAge: "1 day", // Maximum sample age
  maxSize: 100, // Maximum number of samples to retain
  error: 0.03, // Error margin for quantile calculation
  quantiles: [0.1, 0.5, 0.9], // Quantiles to observe (10%, 50%, 90%)
  // Optional
  description: "Measures the distribution of response times"
})

const program = Effect.gen(function* () {
  // Record 100 random response times between 1 and 120 ms
  yield* responseTimeSummary(Random.nextIntBetween(1, 120)).pipe(
    Effect.repeatN(99)
  )

  // Retrieve and log the current state of the summary
  const state = yield* Metric.value(responseTimeSummary)
  console.log("%o", state)
})

Effect.runPromise(program)
/*
Example Output:
SummaryState {
  error: 0.03,    // Error margin used for quantile calculation
  quantiles: [
    [ 0.1, { _id: 'Option', _tag: 'Some', value: 17 } ],   // 10th percentile: 17 ms
    [ 0.5, { _id: 'Option', _tag: 'Some', value: 62 } ],   // 50th percentile (median): 62 ms
    [ 0.9, { _id: 'Option', _tag: 'Some', value: 109 } ]   // 90th percentile: 109 ms
  ],
  count: 100,    // Total number of samples recorded
  min: 4,        // Minimum observed value
  max: 119,      // Maximum observed value
  sum: 6058,     // Sum of all recorded values
  ...
}
*/
```

## Frequency

Frequencies are metrics that help count the occurrences of specific values. Think of them as a set of counters, each associated with a unique value. When new values are observed, the frequency metric automatically creates new counters for those values.

Frequencies are particularly useful for tracking how often distinct string values occur. Some example use cases include:

- Counting the number of invocations for each service in an application, where each service has a logical name.
- Monitoring how frequently different types of failures occur.

**Example** (Tracking Error Occurrences)

In this example, we'll create a `Frequency` to observe how often different error codes occur. This can be applied to effects that return a `string` value:

```ts twoslash
import { Metric, Random, Effect } from "effect"

// Define a frequency metric to track errors
const errorFrequency = Metric.frequency("error_frequency", {
  // Optional
  description: "Counts the occurrences of errors."
})

const task = Effect.gen(function* () {
  const n = yield* Random.nextIntBetween(1, 10)
  return `Error-${n}`
})

// Program that simulates random errors and tracks their occurrences
const program = Effect.gen(function* () {
  yield* errorFrequency(task).pipe(Effect.repeatN(99))

  // Retrieve and log the current state of the summary
  const state = yield* Metric.value(errorFrequency)
  console.log("%o", state)
})

Effect.runPromise(program)
/*
Example Output:
FrequencyState {
  occurrences: Map(9) {
    'Error-7' => 12,
    'Error-2' => 12,
    'Error-4' => 14,
    'Error-1' => 14,
    'Error-9' => 8,
    'Error-6' => 11,
    'Error-5' => 9,
    'Error-3' => 14,
    'Error-8' => 6
  },
  ...
}
*/
```

## Tagging Metrics

Tags are key-value pairs you can add to metrics to provide additional context. They help categorize and filter metrics, making it easier to analyze specific aspects of your application's performance or behavior.

When creating metrics, you can add tags to them. Tags are key-value pairs that provide additional context, helping in categorizing and filtering metrics. This makes it easier to analyze and monitor specific aspects of your application.

### Tagging a Specific Metric

You can tag individual metrics using the `Metric.tagged` function.
This allows you to add specific tags to a single metric, providing detailed context without applying tags globally.

**Example** (Tagging an Individual Metric)

```ts twoslash
import { Metric } from "effect"

// Create a counter metric for request count
// and tag it with "environment: production"
const counter = Metric.counter("request_count").pipe(
  Metric.tagged("environment", "production")
)
```

Here, the `request_count` metric is tagged with `"environment": "production"`, allowing you to filter or analyze metrics by this tag later.

### Tagging Multiple Metrics

You can use `Effect.tagMetrics` to apply tags to all metrics within the same context. This is useful when you want to apply common tags, like the environment (e.g., "production" or "development"), across multiple metrics.

**Example** (Tagging Multiple Metrics)

```ts twoslash
import { Metric, Effect } from "effect"

// Create two separate counters
const counter1 = Metric.counter("counter1")
const counter2 = Metric.counter("counter2")

// Define a task that simulates some work with a slight delay
const task = Effect.succeed(1).pipe(Effect.delay("100 millis"))

// Apply the environment tag to both counters in the same context
Effect.gen(function* () {
  yield* counter1(task)
  yield* counter2(task)
}).pipe(Effect.tagMetrics("environment", "production"))
```

If you only want to apply tags within a specific [scope](/docs/resource-management/scope/), you can use `Effect.tagMetricsScoped`. This limits the tag application to metrics within that scope, allowing for more precise tagging control.
