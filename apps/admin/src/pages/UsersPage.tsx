import { useCallback, useEffect, useState } from "react";
import {
  Badge,
  Box,
  Button,
  Flex,
  Heading,
  HStack,
  Input,
  InputGroup,
  InputLeftElement,
  Spinner,
  Table,
  TableContainer,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
} from "@chakra-ui/react";
import { Search } from "lucide-react";
import { apiRequest } from "../lib/api";

type UserRow = {
  id: string;
  telegramId: string;
  telegramUsername: string | null;
  firstName: string | null;
  lastName: string | null;
  language: string;
  isActive: boolean;
  plan?: string;
  planExpiresAt?: string | null;
  ticketCount: number;
  createdAt: string;
};

export default function UsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await apiRequest<{ total: number; users: UserRow[] }>(
        "/api/admin/users?limit=200",
      );
      setUsers(data.users);
      setTotal(data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load users");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = users.filter((u) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const name = `${u.firstName ?? ""} ${u.lastName ?? ""}`.toLowerCase();
    return (
      name.includes(q) ||
      (u.telegramUsername ?? "").toLowerCase().includes(q) ||
      u.telegramId.includes(q)
    );
  });

  return (
    <Box className="panel-card">
      <Flex
        align={{ base: "start", md: "center" }}
        justify="space-between"
        gap={3}
        mb={5}
        direction={{ base: "column", md: "row" }}
      >
        <Box>
          <Heading size="md">Telegram users</Heading>
          <Text color="gray.500" fontSize="sm" mt={1}>
            {total} registered · tickets count is live
          </Text>
        </Box>
        <HStack>
          <InputGroup maxW="260px">
            <InputLeftElement pointerEvents="none">
              <Search size={16} color="#A0AEC0" />
            </InputLeftElement>
            <Input
              size="sm"
              placeholder="Search name, @username, id..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </InputGroup>
          <Button size="sm" variant="outline" onClick={() => void load()}>
            Refresh
          </Button>
        </HStack>
      </Flex>

      {loading && (
        <Flex justify="center" py={12}>
          <Spinner />
        </Flex>
      )}
      {error && (
        <Text color="red.500" mb={4}>
          {error}
        </Text>
      )}

      {!loading && !error && (
        <TableContainer>
          <Table size="sm" variant="simple">
            <Thead>
              <Tr>
                <Th>Name</Th>
                <Th>Telegram</Th>
                <Th>Plan</Th>
                <Th>Language</Th>
                <Th>Status</Th>
                <Th isNumeric>Tickets</Th>
                <Th>Joined</Th>
              </Tr>
            </Thead>
            <Tbody>
              {filtered.map((u) => (
                <Tr key={u.id}>
                  <Td fontWeight="medium">
                    {u.firstName ?? "—"}
                    {u.lastName ? ` ${u.lastName}` : ""}
                  </Td>
                  <Td>
                    <Text fontSize="sm">
                      {u.telegramUsername ? `@${u.telegramUsername}` : "—"}
                    </Text>
                    <Text fontSize="xs" color="gray.500" fontFamily="mono">
                      {u.telegramId}
                    </Text>
                  </Td>
                  <Td>
                    <Badge
                      colorScheme={
                        u.plan === "PREMIUM"
                          ? "purple"
                          : u.plan === "PLUS"
                            ? "blue"
                            : "gray"
                      }
                      borderRadius="full"
                      px={2}
                    >
                      {u.plan ?? "FREE"}
                    </Badge>
                  </Td>
                  <Td>
                    <Badge variant="subtle" borderRadius="full" px={2}>
                      {u.language === "en" ? "EN" : "AM"}
                    </Badge>
                  </Td>
                  <Td>
                    <Badge
                      colorScheme={u.isActive ? "green" : "red"}
                      borderRadius="full"
                      px={2}
                    >
                      {u.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </Td>
                  <Td isNumeric fontWeight="semibold">
                    {u.ticketCount}
                  </Td>
                  <Td fontSize="sm" color="gray.500">
                    {new Date(u.createdAt).toLocaleString()}
                  </Td>
                </Tr>
              ))}
              {filtered.length === 0 && (
                <Tr>
                  <Td colSpan={7}>
                    <Text textAlign="center" color="gray.500" py={8}>
                      No users match.
                    </Text>
                  </Td>
                </Tr>
              )}
            </Tbody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
}
