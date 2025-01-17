import { Clients, DopplerAddresses } from '../../types';
interface TestEnvironment {
    clients: Clients;
    addresses: DopplerAddresses;
}
export declare function setupTestEnvironment(): Promise<TestEnvironment>;
export {};
