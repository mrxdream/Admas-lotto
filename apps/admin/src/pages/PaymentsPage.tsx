import { useCallback, useEffect, useState } from "react";
import {
  Badge,
  Box,
  Button,
  Flex,
  Heading,
  HStack,
  Image,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Spinner,
  Table,
  TableContainer,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  useDisclosure,
  useToast,
  VStack,
  List,
  ListItem,
} from "@chakra-ui/react";
import { apiRequest } from "../lib/api";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";

type Payment = {
  id: string;
  requestedPlan: "PLUS" | "PREMIUM";
  amountEtb: string;
  screenshotFileId: string | null;
  userNote: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
  adminNote: string | null;
  reviewedAt: string | null;
  createdAt: string;
  user: {
    telegramId: string;
    telegramUsername: string | null;
    firstName: string | null;
    lastName: string | null;
    plan: string;
  };
};

export default function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<"PENDING" | "ALL">("PENDING");
  const [actionId, setActionId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Payment | null>(null);
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null);
  const [screenshotLoading, setScreenshotLoading] = useState(false);
  const [screenshotError, setScreenshotError] = useState("");
  const { isOpen, onOpen, onClose } = useDisclosure();
  const toast = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const qs = filter === "PENDING" ? "?status=PENDING" : "";
      const data = await apiRequest<{ payments: Payment[] }>(
        `/api/admin/payments${qs}`,
      );
      setPayments(data.payments);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load payments");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    void load();
  }, [load]);

  async function loadScreenshot(paymentId: string) {
    setScreenshotLoading(true);
    setScreenshotError("");
    if (screenshotUrl) {
      URL.revokeObjectURL(screenshotUrl);
      setScreenshotUrl(null);
    }
    try {
      const res = await fetch(
        `${API_BASE}/api/admin/payments/${paymentId}/screenshot`,
        { credentials: "include" },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          typeof body.error === "string" ? body.error : "Could not load image",
        );
      }
      const blob = await res.blob();
      setScreenshotUrl(URL.createObjectURL(blob));
    } catch (err) {
      setScreenshotError(
        err instanceof Error ? err.message : "Could not load screenshot",
      );
    } finally {
      setScreenshotLoading(false);
    }
  }

  function openReview(p: Payment) {
    setSelected(p);
    onOpen();
    if (p.screenshotFileId) {
      void loadScreenshot(p.id);
    } else {
      setScreenshotUrl(null);
      setScreenshotError("No screenshot was attached.");
    }
  }

  function handleClose() {
    onClose();
    setSelected(null);
    if (screenshotUrl) {
      URL.revokeObjectURL(screenshotUrl);
      setScreenshotUrl(null);
    }
    setScreenshotError("");
  }

  async function review(id: string, action: "APPROVE" | "REJECT") {
    setActionId(id);
    try {
      await apiRequest(`/api/admin/payments/${id}/review`, {
        method: "POST",
        body: { action, durationDays: 30 },
      });
      toast({
        title: action === "APPROVE" ? "Approved — user upgraded" : "Rejected",
        status: action === "APPROVE" ? "success" : "info",
        duration: 3000,
      });
      handleClose();
      await load();
    } catch (err) {
      toast({
        title: "Review failed",
        description: err instanceof Error ? err.message : "Error",
        status: "error",
      });
    } finally {
      setActionId(null);
    }
  }

  return (
    <Box className="panel-card">
      <Flex
        justify="space-between"
        align={{ base: "start", md: "center" }}
        direction={{ base: "column", md: "row" }}
        gap={3}
        mb={5}
      >
        <Box>
          <Heading size="md">Payment verification</Heading>
          <Text color="gray.500" fontSize="sm" mt={1}>
            Open each request to view the Telebirr screenshot, then approve or
            reject
          </Text>
        </Box>
        <HStack>
          <Button
            size="sm"
            variant={filter === "PENDING" ? "solid" : "outline"}
            colorScheme={filter === "PENDING" ? "orange" : "gray"}
            onClick={() => setFilter("PENDING")}
          >
            Pending
          </Button>
          <Button
            size="sm"
            variant={filter === "ALL" ? "solid" : "outline"}
            onClick={() => setFilter("ALL")}
          >
            All
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

      {!loading && payments.length === 0 && (
        <Text color="gray.500" textAlign="center" py={10}>
          No {filter === "PENDING" ? "pending " : ""}payment requests.
        </Text>
      )}

      {!loading && payments.length > 0 && (
        <TableContainer>
          <Table size="sm">
            <Thead>
              <Tr>
                <Th>User</Th>
                <Th>Plan</Th>
                <Th>Amount</Th>
                <Th>Note</Th>
                <Th>Status</Th>
                <Th>Submitted</Th>
                <Th>Actions</Th>
              </Tr>
            </Thead>
            <Tbody>
              {payments.map((p) => (
                <Tr key={p.id}>
                  <Td>
                    <VStack align="start" spacing={0}>
                      <Text fontSize="sm" fontWeight="medium">
                        {p.user.firstName ?? "—"}
                      </Text>
                      <Text fontSize="xs" color="gray.500">
                        {p.user.telegramUsername
                          ? `@${p.user.telegramUsername}`
                          : p.user.telegramId}
                      </Text>
                    </VStack>
                  </Td>
                  <Td>
                    <Badge colorScheme="purple" borderRadius="full" px={2}>
                      {p.requestedPlan}
                    </Badge>
                  </Td>
                  <Td fontWeight="semibold">{p.amountEtb} ETB</Td>
                  <Td fontSize="sm" maxW="160px">
                    {p.userNote || "—"}
                  </Td>
                  <Td>
                    <Badge
                      colorScheme={
                        p.status === "APPROVED"
                          ? "green"
                          : p.status === "REJECTED"
                            ? "red"
                            : "orange"
                      }
                      borderRadius="full"
                      px={2}
                    >
                      {p.status}
                    </Badge>
                  </Td>
                  <Td fontSize="sm" color="gray.500">
                    {new Date(p.createdAt).toLocaleString()}
                  </Td>
                  <Td>
                    <Button
                      size="xs"
                      colorScheme="blue"
                      onClick={() => openReview(p)}
                    >
                      {p.status === "PENDING" ? "Review screenshot" : "View"}
                    </Button>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </TableContainer>
      )}

      <Modal isOpen={isOpen} onClose={handleClose} size="xl" isCentered>
        <ModalOverlay />
        <ModalContent mx={3} maxH="90vh" overflowY="auto">
          <ModalHeader>Verify payment</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            {selected && (
              <VStack align="stretch" spacing={4}>
                <HStack justify="space-between" flexWrap="wrap" gap={3}>
                  <Box>
                    <Text fontSize="xs" color="gray.500">
                      User
                    </Text>
                    <Text fontWeight="semibold">
                      {selected.user.firstName ?? "—"}{" "}
                      {selected.user.telegramUsername
                        ? `@${selected.user.telegramUsername}`
                        : selected.user.telegramId}
                    </Text>
                  </Box>
                  <Box>
                    <Text fontSize="xs" color="gray.500">
                      Expected
                    </Text>
                    <Text fontWeight="semibold">
                      {selected.amountEtb} ETB · {selected.requestedPlan}
                    </Text>
                  </Box>
                  <Box>
                    <Text fontSize="xs" color="gray.500">
                      Submitted
                    </Text>
                    <Text fontSize="sm">
                      {new Date(selected.createdAt).toLocaleString()}
                    </Text>
                  </Box>
                </HStack>

                {selected.userNote && (
                  <Box bg="gray.50" p={3} borderRadius="md">
                    <Text fontSize="xs" color="gray.500" mb={1}>
                      User note
                    </Text>
                    <Text fontSize="sm">{selected.userNote}</Text>
                  </Box>
                )}

                <Box>
                  <Text fontSize="sm" fontWeight="semibold" mb={2}>
                    Telebirr screenshot
                  </Text>
                  {screenshotLoading && (
                    <Flex justify="center" py={10}>
                      <Spinner />
                    </Flex>
                  )}
                  {screenshotError && (
                    <Text color="red.500" fontSize="sm">
                      {screenshotError}
                    </Text>
                  )}
                  {screenshotUrl && !screenshotLoading && (
                    <Image
                      src={screenshotUrl}
                      alt="Payment screenshot"
                      maxH="360px"
                      mx="auto"
                      borderRadius="md"
                      borderWidth="1px"
                      borderColor="gray.200"
                    />
                  )}
                </Box>

                <Box bg="blue.50" p={4} borderRadius="md">
                  <Text fontSize="sm" fontWeight="semibold" mb={2}>
                    Check before approving
                  </Text>
                  <List spacing={1} fontSize="sm" color="gray.700">
                    <ListItem>
                      • Amount matches <strong>{selected.amountEtb} ETB</strong>
                    </ListItem>
                    <ListItem>
                      • Receiver is your Telebirr number (see Settings)
                    </ListItem>
                    <ListItem>
                      • Transaction looks recent (not an old screenshot)
                    </ListItem>
                    <ListItem>
                      • Same screenshot not reused for another user
                    </ListItem>
                  </List>
                  <Text fontSize="xs" color="gray.500" mt={3}>
                    We do not connect to Telebirr automatically. You confirm the
                    payment by reading the screenshot and, if needed, your
                    Telebirr transaction history.
                  </Text>
                </Box>
              </VStack>
            )}
          </ModalBody>
          <ModalFooter>
            {selected?.status === "PENDING" ? (
              <HStack>
                <Button variant="ghost" onClick={handleClose}>
                  Cancel
                </Button>
                <Button
                  colorScheme="red"
                  variant="outline"
                  onClick={() => selected && void review(selected.id, "REJECT")}
                  isLoading={actionId === selected?.id}
                >
                  Reject
                </Button>
                <Button
                  colorScheme="green"
                  onClick={() =>
                    selected && void review(selected.id, "APPROVE")
                  }
                  isLoading={actionId === selected?.id}
                >
                  Approve & upgrade
                </Button>
              </HStack>
            ) : (
              <Button onClick={handleClose}>Close</Button>
            )}
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
}
