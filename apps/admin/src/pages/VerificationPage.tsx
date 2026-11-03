import { useCallback, useEffect, useState } from "react";
import {
  Badge,
  Box,
  Button,
  Flex,
  Heading,
  HStack,
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
  useToast,
} from "@chakra-ui/react";
import { apiRequest } from "../lib/api";

type Prize = {
  id: string;
  prizeName: string;
  winningNumber: string;
  prizeAmount: string | number | null;
  currency: string;
};

type Draw = {
  id: string;
  drawCode: string;
  drawDateText: string;
  status: "DRAFT" | "VERIFIED" | "PUBLISHED";
  prizes: Prize[];
  verifiedAt?: string | null;
  publishedAt?: string | null;
};

export default function VerificationPage() {
  const [draws, setDraws] = useState<Draw[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionId, setActionId] = useState<string | null>(null);
  const toast = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await apiRequest<{ draws: Draw[] } | Draw[]>(
        "/api/admin/draws",
      );
      const list = Array.isArray(data) ? data : data.draws;
      setDraws(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load draws");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const needsAttention = draws.filter(
    (d) => d.status === "DRAFT" || d.status === "VERIFIED",
  );
  const published = draws.filter((d) => d.status === "PUBLISHED");

  async function verify(draw: Draw) {
    setActionId(draw.id);
    try {
      await apiRequest(`/api/admin/draws/${draw.id}/verify`, {
        method: "POST",
      });
      toast({
        title: "Draw verified",
        description: `${draw.drawCode} is ready to publish.`,
        status: "success",
        duration: 3000,
      });
      await load();
    } catch (err) {
      toast({
        title: "Verify failed",
        description: err instanceof Error ? err.message : "Error",
        status: "error",
      });
    } finally {
      setActionId(null);
    }
  }

  async function publish(draw: Draw) {
    if (
      !window.confirm(
        `Publish ${draw.drawCode}?\n\nThis matches all tickets for "${draw.drawDateText}" against winning numbers and notifies winners on Telegram.`,
      )
    ) {
      return;
    }
    setActionId(draw.id);
    try {
      const result = await apiRequest<{
        matching?: {
          ticketsChecked: number;
          winnersFound: number;
          notificationsSent: number;
        };
      }>(`/api/admin/draws/${draw.id}/publish`, { method: "POST" });
      const m = result.matching;
      toast({
        title: "Draw published",
        description: m
          ? `Checked ${m.ticketsChecked} tickets · ${m.winnersFound} winners · ${m.notificationsSent} notified`
          : "Matching complete",
        status: "success",
        duration: 5000,
      });
      await load();
    } catch (err) {
      toast({
        title: "Publish failed",
        description: err instanceof Error ? err.message : "Error",
        status: "error",
      });
    } finally {
      setActionId(null);
    }
  }

  async function rematch(draw: Draw) {
    setActionId(draw.id);
    try {
      const result = await apiRequest<{
        matching?: {
          ticketsChecked: number;
          winnersFound: number;
          notificationsSent: number;
        };
      }>(`/api/admin/draws/${draw.id}/match`, { method: "POST" });
      const m = result.matching;
      toast({
        title: "Re-match complete",
        description: m
          ? `Checked ${m.ticketsChecked} · winners ${m.winnersFound} · notified ${m.notificationsSent}`
          : "Done",
        status: "info",
        duration: 4000,
      });
      await load();
    } catch (err) {
      toast({
        title: "Match failed",
        description: err instanceof Error ? err.message : "Error",
        status: "error",
      });
    } finally {
      setActionId(null);
    }
  }

  return (
    <VStack align="stretch" spacing={6}>
      <Box className="panel-card">
        <Flex justify="space-between" align="center" mb={4}>
          <Box>
            <Heading size="md">Verification queue</Heading>
            <Text color="gray.500" fontSize="sm" mt={1}>
              Verify prize lists, then publish to match tickets and notify
              winners
            </Text>
          </Box>
          <Button size="sm" variant="outline" onClick={() => void load()}>
            Refresh
          </Button>
        </Flex>

        {loading && (
          <Flex justify="center" py={10}>
            <Spinner />
          </Flex>
        )}
        {error && (
          <Text color="red.500" mb={3}>
            {error}
          </Text>
        )}

        {!loading && needsAttention.length === 0 && (
          <Text color="gray.500" py={6} textAlign="center">
            Nothing waiting for verification. Create a draft draw and add prizes
            first.
          </Text>
        )}

        {!loading && needsAttention.length > 0 && (
          <TableContainer>
            <Table size="sm">
              <Thead>
                <Tr>
                  <Th>Draw</Th>
                  <Th>Date text</Th>
                  <Th>Status</Th>
                  <Th isNumeric>Prizes</Th>
                  <Th>Winning numbers</Th>
                  <Th>Actions</Th>
                </Tr>
              </Thead>
              <Tbody>
                {needsAttention.map((d) => (
                  <Tr key={d.id}>
                    <Td fontWeight="semibold">{d.drawCode}</Td>
                    <Td fontSize="sm">{d.drawDateText}</Td>
                    <Td>
                      <Badge
                        colorScheme={d.status === "DRAFT" ? "gray" : "blue"}
                        borderRadius="full"
                        px={2}
                      >
                        {d.status}
                      </Badge>
                    </Td>
                    <Td isNumeric>{d.prizes.length}</Td>
                    <Td fontSize="xs" fontFamily="mono" maxW="220px">
                      {d.prizes.length === 0
                        ? "—"
                        : d.prizes
                            .map((p) => p.winningNumber)
                            .slice(0, 4)
                            .join(", ")}
                      {d.prizes.length > 4 ? "…" : ""}
                    </Td>
                    <Td>
                      <HStack spacing={2}>
                        {d.status === "DRAFT" && (
                          <Button
                            size="xs"
                            colorScheme="blue"
                            onClick={() => void verify(d)}
                            isLoading={actionId === d.id}
                            isDisabled={d.prizes.length === 0}
                          >
                            Verify
                          </Button>
                        )}
                        {d.status === "VERIFIED" && (
                          <Button
                            size="xs"
                            colorScheme="green"
                            onClick={() => void publish(d)}
                            isLoading={actionId === d.id}
                          >
                            Publish & match
                          </Button>
                        )}
                      </HStack>
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </TableContainer>
        )}
      </Box>

      <Box className="panel-card">
        <Heading size="md" mb={1}>
          Published draws
        </Heading>
        <Text color="gray.500" fontSize="sm" mb={4}>
          Re-run matching if users saved tickets after publish
        </Text>
        {published.length === 0 && !loading && (
          <Text color="gray.500" py={4} textAlign="center">
            No published draws yet.
          </Text>
        )}
        {published.length > 0 && (
          <TableContainer>
            <Table size="sm">
              <Thead>
                <Tr>
                  <Th>Draw</Th>
                  <Th>Date text</Th>
                  <Th isNumeric>Prizes</Th>
                  <Th>Published</Th>
                  <Th>Actions</Th>
                </Tr>
              </Thead>
              <Tbody>
                {published.map((d) => (
                  <Tr key={d.id}>
                    <Td fontWeight="semibold">{d.drawCode}</Td>
                    <Td fontSize="sm">{d.drawDateText}</Td>
                    <Td isNumeric>{d.prizes.length}</Td>
                    <Td fontSize="sm" color="gray.500">
                      {d.publishedAt
                        ? new Date(d.publishedAt).toLocaleString()
                        : "—"}
                    </Td>
                    <Td>
                      <Button
                        size="xs"
                        variant="outline"
                        onClick={() => void rematch(d)}
                        isLoading={actionId === d.id}
                      >
                        Re-match tickets
                      </Button>
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </TableContainer>
        )}
      </Box>
    </VStack>
  );
}
