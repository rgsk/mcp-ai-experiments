import { ISODateString } from "lib/typesJsonData";
import nodeAIExperimentsAxiosInstance from "./nodeAIExperimentsAxiosInstance";
import { encodeQueryParams } from "./utils";

export type JsonData<T> = {
  id: string;
  key: string;
  value: T;
  version: string;
  expireAt: ISODateString | null;
  createdAt: ISODateString;
  updatedAt: ISODateString;
};

const jsonDataService = {
  getKey: async <T>({ key }: { key: string }) => {
    const result = await nodeAIExperimentsAxiosInstance.get<JsonData<T> | null>(
      `/json-data?${encodeQueryParams({ key: key })}`
    );
    return result.data;
  },
  getKeysLike: <T>({ key }: { key: string }) => {
    const path = `/json-data/key-like?${encodeQueryParams({
      key: key,
    })}`;
    return {
      queryKey: [path],
      queryFn: async () => {
        const result = await nodeAIExperimentsAxiosInstance.get<JsonData<T>[]>(
          path
        );
        return result.data;
      },
    };
  },

  deleteKeysLike: async ({ key }: { key: string }) => {
    const result = await nodeAIExperimentsAxiosInstance.delete(
      `/json-data/key-like?${encodeQueryParams({
        key: key,
      })}`
    );
    return result.data;
  },
  deleteKey: async ({ key }: { key: string }) => {
    const result = await nodeAIExperimentsAxiosInstance.delete(
      `/json-data?${encodeQueryParams({ key: key })}`
    );
    return result.data;
  },
  setKey: async <T>({ key, value }: { key: string; value?: T }) => {
    const result = await nodeAIExperimentsAxiosInstance.post(`/json-data`, {
      key: key,
      value,
    });
    return result.data as JsonData<T> | null;
  },
  createMany: async <T>(data: { key: string; value?: T }[]) => {
    const result = await nodeAIExperimentsAxiosInstance.post(
      `/json-data/bulk`,
      {
        data: data.map((d) => ({ key: d.key, value: d.value })),
      }
    );
    return result.data;
  },
};
export default jsonDataService;
