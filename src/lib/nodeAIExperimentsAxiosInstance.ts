import axios from "axios";
import environmentVars from "./environmentVars";
const nodeAIExperimentsAxiosInstance = axios.create({
  baseURL: environmentVars.NODE_AI_EXPERIMENTS_SERVER_URL,
  headers: {
    Authorization: environmentVars.MCP_SECRET,
  },
});
export default nodeAIExperimentsAxiosInstance;
