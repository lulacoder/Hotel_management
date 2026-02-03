import { createFileRoute } from '@tanstack/react-router'
import { SignIn } from '@clerk/clerk-react'



















export const Route = createFileRoute('/sign-in/$')({
  component: SignInCatchAll,
})

function SignInCatchAll() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <SignIn
        routing="path"
        path="/sign-in"
        signUpUrl="/sign-up"
        forceRedirectUrl="/post-login"
      />
    </div>
  )
}
