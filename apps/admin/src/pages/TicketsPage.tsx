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
  VStack,
} from "@chakra-ui/react";
import { Search } from "lucide-react";
import { apiRequest } from "../lib/api";

type TicketRow = {
  id: string;
  ticketNumber: string;
  drawDateText: string;
  expirationDateText: string;
  isChecked: boolean;
  isWinner: boolean;
  checkedAt: string | null;
  notifiedAt: string | null;
  createdAt: string;
  user: {
    telegramId: string;
    telegramUsername: string | null;
    firstName: string | null;
    lastName: string | null;
  };
  prize: {
    prizeName: string;
    prizeAmount: string | number | null;
    currency: string;
  } | null;
};

export default function TicketsPage() {
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [winnersOnly, setWinnersOnly] = useState(false);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const qs = winnersOnly ? "?winnersOnly=true&limit=100" : "?limit=100";
      const data = await apiRequest<{ total: number; tickets: TicketRow[] }>(
        `/api/admin/tickets${qs}`,
      );
      setTickets(data.tickets);
      setTotal(data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load tickets");
    } finally {
      setLoading(false);
    }
  }, [winnersOnly]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = tickets.filter((t) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const name =
      `${t.user.firstName ?? ""} ${t.user.lastName ?? ""}`.toLowerCase();
    return (
      t.ticketNumber.includes(q) ||
      t.drawDateText.toLowerCase().includes(q) ||
      name.includes(q) ||
      (t.user.telegramUsername ?? "").toLowerCase().includes(q) ||
      t.user.telegramId.includes(q)
    );
  });

  function statusBadge(t: TicketRow) {
    if (t.isWinner) {
      return (
        <Badge colorScheme="green" borderRadius="full" px={2}>
          Winner
        </Badge>
      );
    }
    if (t.isChecked) {
      return (
        <Badge colorScheme="gray" borderRadius="full" px={2}>
          No win
        </Badge>
      );
    }
    return (
      <Badge colorScheme="yellow" borderRadius="full" px={2}>
        Pending
      </Badge>
    );
  }

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
          <Heading size="md">Tickets</Heading>
          <Text color="gray.500" fontSize="sm" mt={1}>
            {total} total · live from database · winners synced on publish
          </Text>
        </Box>
        <HStack spacing={3} flexWrap="wrap">
          <InputGroup maxW="240px">
            <InputLeftElement pointerEvents="none">
              <Search size={16} color="#A0AEC0" />
            </InputLeftElement>
            <Input
              size="sm"
              placeholder="Search ticket, user, date..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </InputGroup>
          <Button
            size="sm"
            variant={winnersOnly ? "solid" : "outline"}
            colorScheme={winnersOnly ? "green" : "gray"}
            onClick={() => setWinnersOnly((v) => !v)}
          >
            {winnersOnly ? "Winners only" : "All tickets"}
          </Button>
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
                <Th>Ticket</Th>
                <Th>User</Th>
                <Th>Draw date</Th>
                <Th>Status</Th>
                <Th>Prize</Th>
                <Th>Notified</Th>
                <Th>Saved</Th>
              </Tr>
            </Thead>
            <Tbody>
              {filtered.map((t) => (
                <Tr key={t.id}>
                  <Td fontWeight="semibold" fontFamily="mono">
                    {t.ticketNumber}
                  </Td>
                  <Td>
                    <VStack align="start" spacing={0}>
                      <Text fontSize="sm">
                        {t.user.firstName ?? "—"}
                        {t.user.lastName ? ` ${t.user.lastName}` : ""}
                      </Text>
                      <Text fontSize="xs" color="gray.500">
                        {t.user.telegramUsername
                          ? `@${t.user.telegramUsername}`
                          : t.user.telegramId}
                      </Text>
                    </VStack>
                  </Td>
                  <Td fontSize="sm">{t.drawDateText}</Td>
                  <Td>{statusBadge(t)}</Td>
                  <Td fontSize="sm">
                    {t.prize
                      ? `${t.prize.prizeName}${
                          t.prize.prizeAmount != null
                            ? ` (${t.prize.prizeAmount} ${t.prize.currency})`
                            : ""
                        }`
                      : "—"}
                  </Td>
                  <Td fontSize="sm">
                    {t.notifiedAt
                      ? new Date(t.notifiedAt).toLocaleString()
                      : t.isWinner
                        ? "Pending"
                        : "—"}
                  </Td>
                  <Td fontSize="sm" color="gray.500">
                    {new Date(t.createdAt).toLocaleString()}
                  </Td>
                </Tr>
              ))}
              {filtered.length === 0 && (
                <Tr>
                  <Td colSpan={7}>
                    <Text textAlign="center" color="gray.500" py={8}>
                      No tickets match.
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
