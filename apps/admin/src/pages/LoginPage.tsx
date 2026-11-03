import { useState, type FormEvent } from "react";
import {
  Box,
  Button,
  FormControl,
  FormLabel,
  Heading,
  Input,
  Text,
  VStack,
  Alert,
  AlertIcon,
} from "@chakra-ui/react";
import { apiRequest } from "../lib/api";

type LoginResponse = {
  message: string;
  admin: { username: string };
};

type LoginPageProps = {
  onLogin: () => void;
};

export default function LoginPage({ onLogin }: LoginPageProps) {
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      await apiRequest<LoginResponse>("/api/admin/auth/login", {
        method: "POST",
        body: { username, password },
      });

      onLogin();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Box
      minH="100vh"
      display="flex"
      alignItems="center"
      justifyContent="center"
      bg="gray.50"
      px={4}
    >
      <Box
        bg="white"
        p={{ base: 6, md: 10 }}
        rounded="2xl"
        shadow="xl"
        w="full"
        maxW="420px"
      >
        <VStack spacing={6} align="stretch">
          <Box>
            <Text color="purple.600" fontWeight="bold" mb={2}>
              ADMAS LOTTERY CHECKER
            </Text>
            <Heading size="lg">Welcome back</Heading>
            <Text color="gray.500" mt={2}>
              Sign in to manage lottery draws and results.
            </Text>
          </Box>

          {error && (
            <Alert status="error" rounded="md">
              <AlertIcon />
              {error}
            </Alert>
          )}

          <form onSubmit={handleSubmit}>
            <VStack spacing={4} align="stretch">
              <FormControl isRequired>
                <FormLabel>Username</FormLabel>
                <Input
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  autoComplete="username"
                  placeholder="Enter admin username"
                />
              </FormControl>

              <FormControl isRequired>
                <FormLabel>Password</FormLabel>
                <Input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="current-password"
                  placeholder="Enter admin password"
                />
              </FormControl>

              <Button
                type="submit"
                colorScheme="purple"
                isLoading={loading}
                loadingText="Signing in..."
                w="full"
                mt={2}
              >
                Sign in securely
              </Button>
            </VStack>
          </form>

          <Text color="gray.400" fontSize="xs" textAlign="center">
            Authorized administrators only
          </Text>
        </VStack>
      </Box>
    </Box>
  );
}
