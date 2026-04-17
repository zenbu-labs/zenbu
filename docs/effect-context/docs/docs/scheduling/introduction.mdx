---
title: Introduction
description: Learn the fundamentals of scheduling in Effect, including composable recurrence patterns and handling retries and repetitions.
sidebar:
  order: 0
---

# Scheduling

Scheduling is an important concept in Effect that allows you to define recurring effectful operations. It involves the use of the `Schedule` type, which is an immutable value that describes a scheduled pattern for executing effects.

The `Schedule` type is structured as follows:

```text showLineNumbers=false
          ┌─── The type of output produced by the schedule
          │   ┌─── The type of input consumed by the schedule
          │   │     ┌─── Additional requirements for the schedule
          ▼   ▼     ▼
Schedule<Out, In, Requirements>
```

A schedule operates by consuming values of type `In` (such as errors in the case of `retry`, or values in the case of `repeat`) and producing values of type `Out`. It determines when to halt or continue the execution based on input values and its internal state.

The inclusion of a `Requirements` parameter allows the schedule to leverage additional services or resources as needed.

Schedules are defined as a collection of intervals spread out over time. Each interval represents a window during which the recurrence of an effect is possible.

## Retrying and Repetition

In the realm of scheduling, there are two related concepts: [Retrying](/docs/error-management/retrying/) and [Repetition](/docs/scheduling/repetition/). While they share the same underlying idea, they differ in their focus. Retrying aims to handle failures by executing an effect again, while repetition focuses on executing an effect repeatedly to achieve a desired outcome.

When using schedules for retrying or repetition, each interval's starting boundary determines when the effect will be executed again. For example, in retrying, if an error occurs, the schedule defines when the effect should be retried.

## Composability of Schedules

Schedules are composable, meaning you can combine simple schedules to create more complex recurrence patterns. Operators like `Schedule.union` or `Schedule.intersect` allow you to build sophisticated schedules by combining and modifying existing ones. This flexibility enables you to tailor the scheduling behavior to meet specific requirements.
