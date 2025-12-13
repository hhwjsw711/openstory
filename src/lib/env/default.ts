export const getEnv = () => {
  return process.env || import.meta.env;
};
