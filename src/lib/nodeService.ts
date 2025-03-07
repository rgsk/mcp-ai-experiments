import nodeAIExperimentsAxiosInstance from "./nodeAIExperimentsAxiosInstance";
import { encodeQueryParams } from "./utils";

const nodeService = {
  getUrlContent: async (queryParams: { url: string; type?: string }) => {
    const result = await nodeAIExperimentsAxiosInstance.get(
      `/experiments/url-content?${encodeQueryParams(queryParams)}`
    );
    return result.data;
  },
};
export default nodeService;
