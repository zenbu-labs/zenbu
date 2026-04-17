import zod from "zod";
import type { infer as ZodInfer } from "zod";

export const NO_DEFAULT: unique symbol = Symbol.for("kyju.NO_DEFAULT");

export type Field<T, HasDefault extends boolean = false> = {
  schema: T;
  _defaultValue: any;
  readonly _hasDefault: HasDefault;
};

export type BlobRef = { type: "blob"; debugName?: string };

declare const __collectionRefBrand: unique symbol;
export type CollectionRefBrand<T = unknown> = {
  readonly [__collectionRefBrand]: T;
};
export type CollectionRefValue<T = unknown> = {
  collectionId: string;
  debugName: string;
} & CollectionRefBrand<T>;

export type InferCollectionItem<T> = T extends CollectionRefBrand<infer Item> ? Item : unknown;

export type InferFieldType<T> =
  T extends BlobRef
    ? { blobId: string; debugName: string }
    : T extends { _zod: { output: any } }
      ? ZodInfer<T>
      : never;

export type FieldSchema = BlobRef | { _zod: { output: any } };

export type SchemaShape = Record<string, Field<FieldSchema, boolean> | zod.ZodType>;

export type InferRoot<T extends SchemaShape> = {
  [K in keyof T]: T[K] extends Field<infer S, infer D>
    ? S extends BlobRef
      ? InferFieldType<S>
      : [D] extends [true]
        ? InferFieldType<S>
        : InferFieldType<S> | undefined
    : T[K] extends zod.ZodType<infer O>
      ? O
      : never;
};

export type InferBlobs<T extends SchemaShape> = {
  [K in keyof T as T[K] extends Field<BlobRef, boolean>
    ? K
    : never]: Uint8Array;
};

export type InferSchema<S extends Schema> =
  S extends Schema<infer TShape> ? TShape : never;

type NullableSchema<T> = Omit<T, "_zod"> & { _zod: { output: InferFieldType<T> | null } };

type FieldWithDefault<T> = Field<T, false> & {
  default: (value: InferFieldType<T>) => Field<T, true>;
  nullable: () => FieldWithDefault<NullableSchema<T>>;
};

function wrapField<T>(zodSchema: T): FieldWithDefault<T> {
  const f: Field<T, false> = {
    schema: zodSchema,
    _defaultValue: NO_DEFAULT,
    _hasDefault: false as const,
  };
  return Object.assign(f, {
    default: (value: InferFieldType<T>): Field<T, true> => ({
      schema: zodSchema,
      _defaultValue: value,
      _hasDefault: true as const,
    }),
    nullable: () => wrapField((zodSchema as any).nullable()) as any,
  });
}

type WrappedZod = {
  [K in keyof typeof zod]: (typeof zod)[K] extends (
    ...args: infer A
  ) => infer R
    ? (...args: A) => FieldWithDefault<R>
    : FieldWithDefault<(typeof zod)[K]>;
};

type GenericOverrides = {
  collection: <T extends zod.ZodType>(itemSchema: T, opts?: { debugName?: string }) => zod.ZodType<CollectionRefValue<zod.infer<T>>>;
  blob: (opts?: { debugName?: string }) => Field<BlobRef, false>;
  array: <T extends zod.ZodType>(element: T, params?: string | Parameters<typeof zod.array>[1]) => FieldWithDefault<zod.ZodArray<T>>;
  record: <K extends zod.ZodType<string | number | symbol>, V extends zod.ZodType>(key: K, value: V, params?: string | Parameters<typeof zod.record>[2]) => FieldWithDefault<zod.ZodRecord<K, V>>;
};

type Fields = Omit<WrappedZod, keyof GenericOverrides> & GenericOverrides;

const COLLECTION_REF_MARKER = "__kyjuCollectionRef";

export const f: Fields = new Proxy(
  {
    collection: <T extends zod.ZodType>(_itemSchema: T, opts?: { debugName?: string }) => {
      const schema = zod.custom<CollectionRefValue<zod.infer<T>>>((val) =>
        val != null && typeof val === "object" && "collectionId" in val && "debugName" in val,
      );
      (schema as any)[COLLECTION_REF_MARKER] = true;
      (schema as any)._debugName = opts?.debugName;
      (schema as any)._itemSchema = _itemSchema;
      return schema;
    },
    blob: (opts?: { debugName?: string }): Field<BlobRef, false> => ({
      schema: { type: "blob" as const, debugName: opts?.debugName } as BlobRef,
      _defaultValue: NO_DEFAULT,
      _hasDefault: false as const,
    }),
  } as unknown as Fields,
  {
    get(target, prop, receiver) {
      if (prop in target) return Reflect.get(target, prop, receiver);
      if (typeof prop === "symbol") return undefined;
      const original = (zod as any)[prop];
      if (typeof original === "function") {
        return (...args: unknown[]) => wrapField(original(...args));
      }
      return wrapField(original);
    },
  },
);

export type Schema<TShape extends SchemaShape = SchemaShape> = {
  shape: TShape;
};

export function createSchema<TShape extends SchemaShape>(shape: TShape): Schema<TShape> {
  return { shape };
}

export function makeCollection<T = unknown>(opts?: { debugName?: string; collectionId?: string }): CollectionRefValue<T>;
export function makeCollection<T = unknown>(debugName?: string): CollectionRefValue<T>;
export function makeCollection<T = unknown>(arg?: string | { debugName?: string; collectionId?: string }): CollectionRefValue<T> {
  const opts = typeof arg === "string" ? { debugName: arg } : arg;
  return { collectionId: opts?.collectionId ?? "", debugName: opts?.debugName ?? "" } as CollectionRefValue<T>;
}

export { COLLECTION_REF_MARKER };
