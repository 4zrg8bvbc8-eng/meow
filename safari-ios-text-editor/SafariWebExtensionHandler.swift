import SafariServices
import os.log

// Standard Safari Web Extension bridge. The extension itself is implemented
// entirely in the JavaScript under Resources/, so this handler only needs to
// satisfy the native messaging entry point. It is unchanged from the template
// Xcode generates for a Safari Web Extension.
class SafariWebExtensionHandler: NSObject, NSExtensionRequestHandling {

    func beginRequest(with context: NSExtensionContext) {
        let request = context.inputItems.first as? NSExtensionItem

        let profile: UUID?
        if #available(iOS 17.0, macOS 14.0, *) {
            profile = request?.userInfo?[SFExtensionProfileKey] as? UUID
        } else {
            profile = request?.userInfo?["profile"] as? UUID
        }

        let message: Any?
        if #available(iOS 15.0, macOS 11.0, *) {
            message = request?.userInfo?[SFExtensionMessageKey]
        } else {
            message = request?.userInfo?["message"]
        }

        os_log(.default, "Received message from browser.runtime.sendNativeMessage: %@ (profile: %@)",
               String(describing: message), profile?.uuidString ?? "none")

        let response = NSExtensionItem()
        response.userInfo = [ SFExtensionMessageKey: [ "echo": message ?? NSNull() ] ]

        context.completeRequest(returningItems: [ response ], completionHandler: nil)
    }
}
