import { useSignIn } from "@clerk/nextjs"
export function Test() {
  const result = useSignIn()
  console.log("useSignIn keys:", Object.keys(result))
  return null
}
