import { initializeApp } from "firebase-admin/app";

initializeApp();

export { submitEvent } from "./submitEvent";
export { registerSource } from "./registerSource";
export { scrapeSources, scrapeNow } from "./scrapeFunctions";
export { adminDeleteUser } from "./adminDeleteUser";
