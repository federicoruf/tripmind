import { Router, Request, Response } from "express";

export function sendEventFunction(res: Response) {
  return (event: string, data: unknown) => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };
}
