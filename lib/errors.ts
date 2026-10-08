import { BaseError, InsufficientFundsError, UserRejectedRequestError } from "viem";

function isRejected(error: unknown): boolean {
  return (
    error instanceof UserRejectedRequestError ||
    (typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: number }).code === 4001)
  );
}

export function explainError(error: unknown): string {
  if (error instanceof BaseError) {
    if (error.walk((cause) => isRejected(cause))) {
      return "You closed the wallet request. Nothing was deployed.";
    }
    const short = `${error.shortMessage} ${error.message}`;
    if (
      error.walk((cause) => cause instanceof InsufficientFundsError) ||
      /insufficient funds/i.test(short)
    ) {
      return "Your wallet needs test QMS to pay the network fee. Use the faucet, then try again.";
    }
    if (/user rejected/i.test(short)) {
      return "You closed the wallet request. Nothing was deployed.";
    }
    return error.shortMessage || "The wallet or the network rejected this. Nothing was deployed.";
  }

  if (isRejected(error)) {
    return "You closed the wallet request. Nothing was deployed.";
  }

  if (error instanceof Error && /insufficient funds/i.test(error.message)) {
    return "Your wallet needs test QMS to pay the network fee. Use the faucet, then try again.";
  }

  return "Something went wrong. Nothing was deployed.";
}
