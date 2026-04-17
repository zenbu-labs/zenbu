export type HandshakeMessage = {
  type: "handshake";
  clientId: string;
  version: string;
};

export type HandshakeAckMessage = {
  type: "handshake-ack";
  ok: boolean;
  error?: string;
};

export type RequestMessage = {
  type: "request";
  id: string;
  path: string[];
  args: unknown[];
};

export type ResponseMessage = {
  type: "response";
  id: string;
  result: unknown;
};

export type ErrorResponseMessage = {
  type: "error-response";
  id: string;
  error: { message: string };
};

export type EventMessage = {
  type: "event";
  path: string[];
  data: unknown;
};

export type Message =
  | HandshakeMessage
  | HandshakeAckMessage
  | RequestMessage
  | ResponseMessage
  | ErrorResponseMessage
  | EventMessage;

export const serialize = (msg: Message): string => JSON.stringify(msg);

export const deserialize = (data: string): Message => JSON.parse(data) as Message;
