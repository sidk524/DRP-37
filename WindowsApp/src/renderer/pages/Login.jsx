import AuthLayout from "../components/AuthLayout";

function Login() {
    return (
        <AuthLayout
            title="Login to account"
            subtitle="Enter your email to login to Tether"
            formEndpoint="/login"
            subText="Don't have an account?"
            linkEndpoint="/"
            linkText="Register"
        >
        </AuthLayout>
    );
}

export default Login;