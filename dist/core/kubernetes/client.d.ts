/**
 * Enhanced Kubernetes Client with Dynamic Resource Support
 */
export interface KubernetesResource {
    name: string;
    namespace?: string;
    kind?: string;
    status?: string;
    [key: string]: unknown;
}
export interface ListResourcesOptions {
    namespace?: string;
    allNamespaces?: boolean;
    names?: string;
    fieldSelector?: string;
    labelSelector?: string;
}
export declare class KubernetesClient {
    private kc;
    private objectApi;
    constructor();
    getCurrentContext(): string;
    /**
     * List resources dynamically using unstructured objects
     */
    listUnstructuredResources(resourceType: string, options?: ListResourcesOptions): Promise<string>;
    /**
     * Resolve resource type to API Version, Kind, and Plural
     */
    private resolveResourceGVK;
    /**
     * Legacy support or specialized methods
     */
    getResourceSummary(namespace?: string, resourceTypes?: string[]): Promise<string>;
    createResource(yaml: string): Promise<string>;
    patchResource(kind: string, name: string, patch: string, namespace?: string, strategy?: 'strategic' | 'merge' | 'json' | 'apply'): Promise<string>;
}
export declare function createKubernetesClient(): KubernetesClient | null;
