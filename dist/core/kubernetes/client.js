/**
 * Enhanced Kubernetes Client with Dynamic Resource Support
 */
import * as k8s from '@kubernetes/client-node';
import { t } from '../../i18n.js';
// Monkey-patch Promise to support .toPromise() if it doesn't exist.
// This is a workaround for a bug in @kubernetes/client-node v1.4.0's rxjsStub
// where it expects middleware to return an object with .toPromise(),
// but the library's own auth middleware returns a plain Promise.
if (!Promise.prototype.toPromise) {
    Promise.prototype.toPromise = function () {
        return this;
    };
}
export class KubernetesClient {
    kc;
    objectApi;
    constructor() {
        this.kc = new k8s.KubeConfig();
        this.kc.loadFromDefault();
        this.objectApi = k8s.KubernetesObjectApi.makeApiClient(this.kc);
    }
    getCurrentContext() {
        return this.kc.getCurrentContext();
    }
    /**
     * List resources dynamically using unstructured objects
     */
    async listUnstructuredResources(resourceType, options = {}) {
        try {
            const { apiVersion, kind } = await this.resolveResourceGVK(resourceType);
            const namespace = options.allNamespaces
                ? undefined
                : options.namespace || 'default';
            // Optimize: Use fieldSelector for metadata.name if a single name is provided.
            // This is much faster as the filtering happens on the API server.
            let fieldSelector = options.fieldSelector;
            if (options.names && !fieldSelector) {
                const nameList = options.names.split(',').map((n) => n.trim());
                if (nameList.length === 1) {
                    fieldSelector = `metadata.name=${nameList[0]}`;
                }
            }
            const response = await this.objectApi.list(apiVersion, kind, namespace, undefined, // pretty
            undefined, // exact
            undefined, // export
            fieldSelector, options.labelSelector);
            let items = response.items || [];
            // Client-side fallback for multiple names (K8s fieldSelector doesn't support OR)
            if (options.names) {
                const nameList = options.names.split(',').map((n) => n.trim());
                if (nameList.length > 1) {
                    items = items.filter((item) => nameList.includes(item.metadata?.name));
                }
            }
            if (items.length === 0) {
                return `No ${resourceType} found${options.names ? ` with names: ${options.names}` : ''}.`;
            }
            // Return items as a YAML-formatted string
            return items.map((item) => k8s.dumpYaml(item)).join('---\n');
        }
        catch (error) {
            const msg = error instanceof Error ? error.message : 'Unknown error';
            throw new Error(`Failed to list ${resourceType}: ${msg}`);
        }
    }
    /**
     * Resolve resource type to API Version, Kind, and Plural
     */
    async resolveResourceGVK(resourceType) {
        const lowerType = resourceType.toLowerCase();
        // Common static mappings for speed
        const staticMappings = {
            pods: { apiVersion: 'v1', kind: 'Pod', plural: 'pods' },
            pod: { apiVersion: 'v1', kind: 'Pod', plural: 'pods' },
            po: { apiVersion: 'v1', kind: 'Pod', plural: 'pods' },
            deployments: {
                apiVersion: 'apps/v1',
                kind: 'Deployment',
                plural: 'deployments',
            },
            deployment: {
                apiVersion: 'apps/v1',
                kind: 'Deployment',
                plural: 'deployments',
            },
            deploy: {
                apiVersion: 'apps/v1',
                kind: 'Deployment',
                plural: 'deployments',
            },
            services: { apiVersion: 'v1', kind: 'Service', plural: 'services' },
            service: { apiVersion: 'v1', kind: 'Service', plural: 'services' },
            svc: { apiVersion: 'v1', kind: 'Service', plural: 'services' },
            namespaces: { apiVersion: 'v1', kind: 'Namespace', plural: 'namespaces' },
            namespace: { apiVersion: 'v1', kind: 'Namespace', plural: 'namespaces' },
            ns: { apiVersion: 'v1', kind: 'Namespace', plural: 'namespaces' },
            nodes: { apiVersion: 'v1', kind: 'Node', plural: 'nodes' },
            node: { apiVersion: 'v1', kind: 'Node', plural: 'nodes' },
            no: { apiVersion: 'v1', kind: 'Node', plural: 'nodes' },
            configmaps: { apiVersion: 'v1', kind: 'ConfigMap', plural: 'configmaps' },
            configmap: { apiVersion: 'v1', kind: 'ConfigMap', plural: 'configmaps' },
            cm: { apiVersion: 'v1', kind: 'ConfigMap', plural: 'configmaps' },
            secrets: { apiVersion: 'v1', kind: 'Secret', plural: 'secrets' },
            secret: { apiVersion: 'v1', kind: 'Secret', plural: 'secrets' },
            ingresses: {
                apiVersion: 'networking.k8s.io/v1',
                kind: 'Ingress',
                plural: 'ingresses',
            },
            ingress: {
                apiVersion: 'networking.k8s.io/v1',
                kind: 'Ingress',
                plural: 'ingresses',
            },
            ing: {
                apiVersion: 'networking.k8s.io/v1',
                kind: 'Ingress',
                plural: 'ingresses',
            },
            statefulsets: {
                apiVersion: 'apps/v1',
                kind: 'StatefulSet',
                plural: 'statefulsets',
            },
            statefulset: {
                apiVersion: 'apps/v1',
                kind: 'StatefulSet',
                plural: 'statefulsets',
            },
            sts: {
                apiVersion: 'apps/v1',
                kind: 'StatefulSet',
                plural: 'statefulsets',
            },
            daemonsets: {
                apiVersion: 'apps/v1',
                kind: 'DaemonSet',
                plural: 'daemonsets',
            },
            daemonset: {
                apiVersion: 'apps/v1',
                kind: 'DaemonSet',
                plural: 'daemonsets',
            },
            ds: { apiVersion: 'apps/v1', kind: 'DaemonSet', plural: 'daemonsets' },
            jobs: { apiVersion: 'batch/v1', kind: 'Job', plural: 'jobs' },
            job: { apiVersion: 'batch/v1', kind: 'Job', plural: 'jobs' },
            cronjobs: { apiVersion: 'batch/v1', kind: 'CronJob', plural: 'cronjobs' },
            cronjob: { apiVersion: 'batch/v1', kind: 'CronJob', plural: 'cronjobs' },
            cj: { apiVersion: 'batch/v1', kind: 'CronJob', plural: 'cronjobs' },
            persistentvolumes: {
                apiVersion: 'v1',
                kind: 'PersistentVolume',
                plural: 'persistentvolumes',
            },
            persistentvolume: {
                apiVersion: 'v1',
                kind: 'PersistentVolume',
                plural: 'persistentvolumes',
            },
            pv: {
                apiVersion: 'v1',
                kind: 'PersistentVolume',
                plural: 'persistentvolumes',
            },
            persistentvolumeclaims: {
                apiVersion: 'v1',
                kind: 'PersistentVolumeClaim',
                plural: 'persistentvolumeclaims',
            },
            persistentvolumeclaim: {
                apiVersion: 'v1',
                kind: 'PersistentVolumeClaim',
                plural: 'persistentvolumeclaims',
            },
            pvc: {
                apiVersion: 'v1',
                kind: 'PersistentVolumeClaim',
                plural: 'persistentvolumeclaims',
            },
        };
        if (staticMappings[lowerType]) {
            return staticMappings[lowerType];
        }
        // Last resort: assume kind is Capitalized version of resourceType
        const kind = lowerType.charAt(0).toUpperCase() + lowerType.slice(1);
        const plural = lowerType.endsWith('s') ? lowerType : lowerType + 's';
        return { apiVersion: 'v1', kind, plural };
    }
    /**
     * Legacy support or specialized methods
     */
    async getResourceSummary(namespace = 'default', resourceTypes = ['pods', 'deployments', 'services']) {
        try {
            const counts = {};
            for (const type of resourceTypes) {
                const yaml = await this.listUnstructuredResources(type, { namespace });
                counts[type] = yaml.startsWith('No ') ? 0 : yaml.split('---\n').length;
            }
            const details = Object.entries(counts)
                .map(([type, count]) => `- ${type.charAt(0).toUpperCase() + type.slice(1)}: ${count}`)
                .join('\n');
            return `Namespace: ${namespace}
Summary:
${details}`;
        }
        catch (error) {
            return `Error getting resource summary: ${error instanceof Error ? error.message : 'Unknown error'}`;
        }
    }
    async createResource(yaml) {
        try {
            const spec = k8s.loadYaml(yaml);
            const response = await this.objectApi.create(spec);
            return k8s.dumpYaml(response);
        }
        catch (error) {
            const msg = error instanceof Error ? error.message : 'Unknown error';
            throw new Error(`Failed to create resource: ${msg}`);
        }
    }
    async patchResource(kind, name, patch, namespace = 'default', strategy = 'strategic') {
        try {
            const { apiVersion, kind: resolvedKind } = await this.resolveResourceGVK(kind);
            // Parse the mandatory string patch
            let parsedPatch;
            try {
                parsedPatch = JSON.parse(patch);
            }
            catch (e) {
                throw new Error(`Failed to parse patch JSON: ${e instanceof Error ? e.message : String(e)}`);
            }
            // Map strategy to correct patch content-type
            let patchStrategy;
            switch (strategy) {
                case 'merge':
                    patchStrategy = 'application/merge-patch+json';
                    break;
                case 'json':
                    patchStrategy = 'application/json-patch+json';
                    break;
                case 'apply':
                    patchStrategy = 'application/apply-patch+yaml';
                    break;
                default:
                    patchStrategy = 'application/strategic-merge-patch+json';
                    break;
            }
            // Use KubernetesObjectApi.patch which is more reliable for unstructured resources.
            // The "spec" for patch must contain identity fields (apiVersion, kind, name, namespace)
            // plus the actual patch content.
            const patchSpec = {
                apiVersion,
                kind: resolvedKind,
                metadata: {
                    name,
                    namespace,
                },
                ...parsedPatch,
            };
            await this.objectApi.patch(patchSpec, undefined, // pretty
            undefined, // dryRun
            strategy === 'apply' ? 'cubectl' : undefined, // fieldManager
            strategy === 'apply' ? true : undefined, // force
            patchStrategy);
            return t('kubernetes.patchSuccess')
                .replace('{kind}', kind)
                .replace('{name}', name);
        }
        catch (error) {
            const msg = error instanceof Error ? error.message : 'Unknown error';
            let reason = msg;
            if (error && error.body) {
                reason = JSON.stringify(error.body);
            }
            throw new Error(t('kubernetes.patchFailure').replace('{reason}', reason));
        }
    }
}
export function createKubernetesClient() {
    try {
        return new KubernetesClient();
    }
    catch (error) {
        console.error('Failed to create Kubernetes client:', error);
        return null;
    }
}
//# sourceMappingURL=client.js.map