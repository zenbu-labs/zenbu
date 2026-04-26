// Content script: imports the drag-region forwarder to force install in
// any view, even ones that don't themselves use `useDragRegion`. The
// forwarder is an auto-init side effect of the import.
import "./drag-region"
