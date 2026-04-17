import type { PermissionRequestProps } from "../../../lib/chat-components"
import { PermissionCard } from "../../PermissionCard"

export function PermissionRequest(props: PermissionRequestProps) {
  return (
    <div className="px-3">
      <PermissionCard
        title={props.title}
        kind={props.kind}
        description={props.description}
        options={props.options}
        onSelect={props.onSelect}
      />
    </div>
  )
}
