#!/usr/bin/env node
/**
 * OpenShell CLI Entry Point
 */
// Monkey-patch Promise to support .toPromise() if it doesn't exist.
// This is a workaround for a bug in @kubernetes/client-node v1.4.0's rxjsStub
// where it expects middleware to return an object with .toPromise(),
// but the library's own auth middleware returns a plain Promise.
if (!Promise.prototype.toPromise) {
    Promise.prototype.toPromise = function () {
        return this;
    };
}
import { main } from './openshell.js';
main().catch((error) => {
    console.error(error);
    process.exit(1);
});
//# sourceMappingURL=index.js.map