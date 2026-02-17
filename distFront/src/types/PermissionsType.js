"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.permissions = exports.Scope = exports.Method = void 0;
var Method;
(function (Method) {
    Method["GET"] = "GET";
    Method["POST"] = "POST";
    Method["PUT"] = "PUT";
    Method["DELETE"] = "DELETE";
})(Method || (exports.Method = Method = {}));
var Scope;
(function (Scope) {
    Scope["Read"] = "read";
    Scope["Write"] = "write";
    Scope["Update"] = "update";
    Scope["Delete"] = "delete";
})(Scope || (exports.Scope = Scope = {}));
exports.permissions = [
    {
        method: Method.GET,
        scope: Scope.Read,
        permissions: ["admin_granted"],
    },
    {
        method: Method.POST,
        scope: Scope.Write,
        permissions: ["admin_granted"],
    },
    {
        method: Method.PUT,
        scope: Scope.Update,
        permissions: ["admin_granted"],
    },
    {
        method: Method.DELETE,
        scope: Scope.Delete,
        permissions: ["admin_granted"],
    },
];
