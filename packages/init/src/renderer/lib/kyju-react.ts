import { createKyjuReact } from "@zenbu/kyju/react";
import type { CollectionResult } from "@zenbu/kyju/react";
import type { SchemaShape, CollectionNode, ClientProxy } from "@zenbu/kyju";
import type {
  CollectionRefBrand,
  CollectionRefValue,
} from "@zenbu/kyju/schema";
import type { DbRoot } from "#registry/db-sections";

const kyju = createKyjuReact<SchemaShape>();

export const { KyjuProvider } = kyju;

export function useDb<T>(selector: (root: DbRoot) => T): T;
export function useDb(): DbRoot;
export function useDb<T>(selector?: (root: DbRoot) => T): T | DbRoot {
  return kyju.useDb((raw: unknown) => {
    const root = raw as DbRoot;
    return selector ? selector(root) : root;
  });
}

type Primitive = string | number | boolean | null | undefined;

type InferCollectionItemFromRef<T> = [T] extends [
  CollectionRefValue<infer Item>,
]
  ? Item
  : [T] extends [CollectionRefBrand<infer Item>]
  ? Item
  : unknown;

export function useCollection<T extends { collectionId: string }>(
  ref: T | null | undefined,
): CollectionResult<InferCollectionItemFromRef<T>> {
  return kyju.useCollection(
    ref as Parameters<typeof kyju.useCollection>[0],
  ) as unknown as CollectionResult<InferCollectionItemFromRef<T>>;
}

type FieldProxy<T> = [T] extends [CollectionRefValue<infer Item>]
  ? CollectionNode<Item>
  : [T] extends [CollectionRefBrand<infer Item>]
  ? CollectionNode<Item>
  : {
      read(): T;
      set(value: T): Promise<void>;
      subscribe(cb: (value: T) => void): () => void;
    } & ([T] extends [Primitive]
      ? {}
      : [T] extends [(infer E)[]]
      ? { [index: number]: FieldProxy<E> }
      : [T] extends [Record<string, unknown>]
      ? { [K in keyof T]: FieldProxy<T[K]> }
      : {});

type SectionProxy<S> = {
  [K in keyof S]: FieldProxy<S[K]>;
};

export type SectionedClient = Omit<
  ClientProxy<SchemaShape>,
  "readRoot" | "update"
> & {
  readRoot(): DbRoot;
  update(fn: (root: DbRoot) => void | DbRoot): Promise<void>;
  plugin: {
    [K in keyof DbRoot["plugin"]]: SectionProxy<DbRoot["plugin"][K]>;
  };
};
