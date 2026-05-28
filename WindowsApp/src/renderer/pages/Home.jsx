import '../styles/Home.css'
import AuthLayout from "../components/AuthLayout";

function Home() {
    return (
        <AuthLayout
            title="Sign up for an account"
            subtitle="Enter your email to sign up for Tether"
            formEndpoint="register"
            subText="Already have an account?"
            linkEndpoint="/login"
            linkText="Login"
        >
        </AuthLayout>
    )
}

export default Home