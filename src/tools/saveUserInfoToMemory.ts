import jsonDataService from "lib/jsonDataService";
import { Memory } from "lib/typesJsonData";
import { v4 } from "uuid";

const saveUserInfoToMemory = async ({
  statement,
  userEmail,
}: {
  statement: string;
  userEmail: string;
}) => {
  const key = `reactAIExperiments/users/${userEmail}/memories`;
  const jsonData = await jsonDataService.getKey<Memory[]>({ key });
  const memory: Memory = {
    id: v4(),
    statement,
    createdAt: new Date().toISOString(),
  };
  if (!jsonData) {
    const jsonData = await jsonDataService.setKey({
      key: key,
      value: [memory],
    });
  } else {
    const memories = jsonData.value;
    const newJsonData = await jsonDataService.setKey({
      key: key,
      value: [...memories, memory],
    });
  }
  return "Saved successfully.";
};

export default saveUserInfoToMemory;
