import { useEffect, useState } from "react";
import PrizeEntriesPage from "./pages/PrizeEntriesPage";
import LoginPage from "./pages/LoginPage";
import TicketsPage from "./pages/TicketsPage";
import UsersPage from "./pages/UsersPage";
import VerificationPage from "./pages/VerificationPage";
import ActivityLogsPage from "./pages/ActivityLogsPage";
import SettingsPage from "./pages/SettingsPage";
import PaymentsPage from "./pages/PaymentsPage";
import { apiRequest } from "./lib/api";
import {
  Box,
  Flex,
  Grid,
  GridItem,
  Heading,
  Text,
  Button,
  Badge,
  Input,
  InputGroup,
  InputLeftElement,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  TableContainer,
  HStack,
  VStack,
  Divider,
  Avatar,
  Icon,
  useDisclosure,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalCloseButton,
  FormControl,
  FormLabel,
  Textarea,
} from "@chakra-ui/react";
import {
  LayoutDashboard,
  Ticket,
  Trophy,
  Users,
  Settings,
  Search,
  Bell,
  Plus,
  ArrowUpRight,
  ShieldCheck,
  CalendarDays,
  ClipboardList,
  Menu,
  X,
} from "lucide-react";

type Draw = {
  id: string;
  code: string;
  date: string;
  status: "DRAFT" | "VERIFIED" | "PUBLISHED";
  prizes: number;
};

const initialDraws: Draw[] = [];
type ApiDraw = {
  id: string;
  drawCode: string;
  drawDateText: string;
  status: "DRAFT" | "VERIFIED" | "PUBLISHED";
  prizes: unknown[];
};
const navigation = [
  { label: "Overview", icon: LayoutDashboard },
  { label: "Draw Management", icon: CalendarDays },
  { label: "Prize Entries", icon: Trophy },
  { label: "Tickets", icon: Ticket },
  { label: "Users", icon: Users },
  { label: "Payments", icon: ShieldCheck },
  { label: "Verification", icon: ShieldCheck },
  { label: "Activity Logs", icon: ClipboardList },
  { label: "Settings", icon: Settings },
];

function StatCard({
  title,
  value,
  description,
  icon,
}: {
  title: string;
  value: string;
  description: string;
  icon: typeof Users;
}) {
  return (
    <Box className="stat-card">
      <Flex justify="space-between" align="start">
        <Box>
          <Text color="gray.500" fontSize="sm">
            {title}
          </Text>
          <Heading size="lg" mt={2} color="gray.800">
            {value}
          </Heading>
        </Box>
        <Box className="stat-icon">
          <Icon as={icon} boxSize={5} />
        </Box>
      </Flex>
      <Text mt={4} color="gray.500" fontSize="xs">
        {description}
      </Text>
    </Box>
  );
}

function StatusBadge({ status }: { status: Draw["status"] }) {
  const styles = {
    DRAFT: { colorScheme: "gray", label: "Draft" },
    VERIFIED: { colorScheme: "blue", label: "Verified" },
    PUBLISHED: { colorScheme: "green", label: "Published" },
  };

  const style = styles[status];

  return (
    <Badge
      colorScheme={style.colorScheme}
      borderRadius="full"
      px={3}
      py={1}
      textTransform="none"
    >
      {style.label}
    </Badge>
  );
}

export default function App() {
  // ALL hooks must run before any early return
  const [authChecking, setAuthChecking] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [activePage, setActivePage] = useState("Overview");
  const [search, setSearch] = useState("");
  const [draws, setDraws] = useState<Draw[]>([]);
  const [drawsLoading, setDrawsLoading] = useState(false);
  const [drawsError, setDrawsError] = useState("");
  const [creatingDraw, setCreatingDraw] = useState(false);
  const [drawCode, setDrawCode] = useState("");
  const [drawDate, setDrawDate] = useState("");
  const [notes, setNotes] = useState("");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [drawActionId, setDrawActionId] = useState<string | null>(null);
  const [stats, setStats] = useState<{
    users: number;
    tickets: number;
    winners: number;
    draws: {
      draft: number;
      verified: number;
      published: number;
      total: number;
    };
  } | null>(null);
  const { isOpen, onOpen, onClose } = useDisclosure();

  useEffect(() => {
    let active = true;

    apiRequest<{ authenticated: boolean }>("/api/admin/auth/me")
      .then((data) => {
        if (active) setIsAuthenticated(data.authenticated);
      })
      .catch(() => {
        if (active) setIsAuthenticated(false);
      })
      .finally(() => {
        if (active) setAuthChecking(false);
      });

    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (!isAuthenticated) return;

    let active = true;

    async function loadDraws() {
      setDrawsLoading(true);
      setDrawsError("");

      try {
        const response = await apiRequest<ApiDraw[] | { draws: ApiDraw[] }>(
          "/api/admin/draws",
        );

        const records = Array.isArray(response) ? response : response.draws;

        const mappedDraws: Draw[] = records.map((draw) => ({
          id: draw.id,
          code: draw.drawCode,
          date: draw.drawDateText,
          status: draw.status,
          prizes: draw.prizes.length,
        }));

        if (active) {
          setDraws(mappedDraws);
        }
      } catch (error) {
        if (active) {
          setDrawsError(
            error instanceof Error
              ? error.message
              : "Could not load lottery draws.",
          );
        }
      } finally {
        if (active) {
          setDrawsLoading(false);
        }
      }
    }

    void loadDraws();

    return () => {
      active = false;
    };
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;
    let active = true;
    apiRequest<{
      users: number;
      tickets: number;
      winners: number;
      draws: {
        draft: number;
        verified: number;
        published: number;
        total: number;
      };
    }>("/api/admin/stats")
      .then((data) => {
        if (active) setStats(data);
      })
      .catch(() => {
        if (active) setStats(null);
      });
    return () => {
      active = false;
    };
  }, [isAuthenticated, activePage]);

  const filteredDraws = draws.filter((draw) =>
    draw.code.toLowerCase().includes(search.toLowerCase()),
  );

  async function createDraw() {
    if (!drawCode.trim() || !drawDate.trim()) return;

    setCreatingDraw(true);
    setDrawsError("");

    try {
      await apiRequest("/api/admin/draws", {
        method: "POST",
        body: {
          drawCode: drawCode.trim(),
          drawDateText: drawDate.trim(),
          notes: notes.trim() || undefined,
        },
      });

      // Clear the form after successful creation.
      setDrawCode("");
      setDrawDate("");
      setNotes("");

      onClose();
      setActivePage("Draw Management");

      // Reload the records from the database.
      const response = await apiRequest<ApiDraw[] | { draws: ApiDraw[] }>(
        "/api/admin/draws",
      );

      const records = Array.isArray(response) ? response : response.draws;

      setDraws(
        records.map((draw) => ({
          id: draw.id,
          code: draw.drawCode,
          date: draw.drawDateText,
          status: draw.status,
          prizes: draw.prizes.length,
        })),
      );
    } catch (error) {
      setDrawsError(
        error instanceof Error ? error.message : "Could not create the draw.",
      );
    } finally {
      setCreatingDraw(false);
    }
  }

  async function reloadDraws() {
    const response = await apiRequest<ApiDraw[] | { draws: ApiDraw[] }>(
      "/api/admin/draws",
    );
    const records = Array.isArray(response) ? response : response.draws;
    setDraws(
      records.map((draw) => ({
        id: draw.id,
        code: draw.drawCode,
        date: draw.drawDateText,
        status: draw.status,
        prizes: draw.prizes.length,
      })),
    );
  }

  async function verifyDraw(draw: Draw) {
    setDrawActionId(draw.id);
    setDrawsError("");
    try {
      await apiRequest(`/api/admin/draws/${draw.id}/verify`, {
        method: "POST",
      });
      await reloadDraws();
    } catch (error) {
      setDrawsError(
        error instanceof Error ? error.message : "Could not verify draw.",
      );
    } finally {
      setDrawActionId(null);
    }
  }

  async function publishDraw(draw: Draw) {
    if (
      !window.confirm(
        `Publish draw ${draw.code}? This will match tickets against winning numbers and notify winners.`,
      )
    ) {
      return;
    }
    setDrawActionId(draw.id);
    setDrawsError("");
    try {
      const result = await apiRequest<{
        matching?: {
          ticketsChecked: number;
          winnersFound: number;
          notificationsSent: number;
        };
      }>(`/api/admin/draws/${draw.id}/publish`, { method: "POST" });
      await reloadDraws();
      const m = result.matching;
      if (m) {
        window.alert(
          `Published.\nTickets checked: ${m.ticketsChecked}\nWinners: ${m.winnersFound}\nNotifications sent: ${m.notificationsSent}`,
        );
      }
    } catch (error) {
      setDrawsError(
        error instanceof Error ? error.message : "Could not publish draw.",
      );
    } finally {
      setDrawActionId(null);
    }
  }

  // Early returns come AFTER all hooks
  if (authChecking) {
    return (
      <Box minH="100vh" display="grid" placeItems="center" bg="gray.50">
        <Text color="gray.600">Checking your admin session...</Text>
      </Box>
    );
  }

  if (!isAuthenticated) {
    return <LoginPage onLogin={() => setIsAuthenticated(true)} />;
  }

  const pageDescriptions: Record<string, string> = {
    Overview: "Live counts for users, tickets, winners, and draws.",
    "Draw Management": "Create draws and manage their publication lifecycle.",
    "Prize Entries": "Add and review winning numbers and prize amounts.",
    Tickets: "Every ticket saved from Telegram — status synced on publish.",
    Users: "Telegram users registered via the bot.",
    Payments: "Review Telebirr screenshots and assign Plus / Premium.",
    Verification: "Verify prize lists, publish, and re-match winners.",
    "Activity Logs":
      "Tickets saved, winners matched, draws verified & published.",
    Settings: "Ticket limits on/off, prices, Telebirr, session health.",
  };

  return (
    <Flex minH="100vh" bg="#F5F7FB" color="gray.800">
      {mobileNavOpen && (
        <Box
          position="fixed"
          inset={0}
          bg="blackAlpha.500"
          zIndex={19}
          display={{ base: "block", lg: "none" }}
          onClick={() => setMobileNavOpen(false)}
        />
      )}

      <Box
        className={`sidebar ${mobileNavOpen ? "sidebar-open" : ""}`}
        display="flex"
        flexDirection="column"
        w="250px"
        flexShrink={0}
        bg="#111827"
        color="white"
        minH="100vh"
        position={{ base: "fixed", lg: "sticky" }}
        top={0}
        left={0}
        zIndex={20}
        height="100vh"
        overflowY="auto"
      >
        <Flex align="center" gap={3} px={6} py={7}>
          <Flex
            bg="#D8F36A"
            color="#111827"
            w="42px"
            h="42px"
            borderRadius="xl"
            align="center"
            justify="center"
          >
            <Icon as={Ticket} boxSize={6} />
          </Flex>
          <Box>
            <Heading fontSize="md" letterSpacing="-0.4px">
              ADMAS
            </Heading>
            <Text color="gray.400" fontSize="xs">
              Lottery Control Center
            </Text>
          </Box>
          <Box ml="auto" display={{ base: "block", lg: "none" }}>
            <Button
              size="sm"
              variant="ghost"
              color="white"
              onClick={() => setMobileNavOpen(false)}
              aria-label="Close navigation"
            >
              <Icon as={X} />
            </Button>
          </Box>
        </Flex>

        <Text px={6} mb={3} fontSize="xs" color="gray.500" fontWeight="bold">
          WORKSPACE
        </Text>

        <VStack align="stretch" spacing={1} px={3}>
          {navigation.map((item) => {
            const active = activePage === item.label;

            return (
              <Button
                key={item.label}
                justifyContent="flex-start"
                variant="ghost"
                color={active ? "#D8F36A" : "gray.300"}
                bg={active ? "whiteAlpha.100" : "transparent"}
                _hover={{ bg: "whiteAlpha.100", color: "white" }}
                leftIcon={<Icon as={item.icon} boxSize={4} />}
                fontWeight={active ? "semibold" : "normal"}
                fontSize="sm"
                onClick={() => {
                  setActivePage(item.label);
                  setMobileNavOpen(false);
                }}
              >
                {item.label}
              </Button>
            );
          })}
        </VStack>

        <Box px={4} mt={10}>
          <Box
            bg="whiteAlpha.100"
            border="1px solid"
            borderColor="whiteAlpha.200"
            borderRadius="xl"
            p={4}
          >
            <Icon as={ShieldCheck} color="#D8F36A" boxSize={5} />
            <Text fontWeight="semibold" mt={3} fontSize="sm">
              Admin workspace
            </Text>
            <Text color="gray.400" fontSize="xs" mt={1} lineHeight="tall">
              Verify official results before publishing them to users.
            </Text>
          </Box>
        </Box>

        <Flex px={5} py={5} mt="auto" align="center" gap={3}>
          <Avatar size="sm" name="Admin User" bg="#D8F36A" color="gray.900" />
          <Box overflow="hidden">
            <Text fontSize="sm" fontWeight="semibold">
              Admin User
            </Text>
            <Text color="gray.400" fontSize="xs">
              Local preview
            </Text>
          </Box>
        </Flex>
      </Box>

      <Box flex="1" minW={0}>
        <Flex
          bg="white"
          borderBottom="1px solid"
          borderColor="gray.200"
          px={{ base: 4, md: 8 }}
          py={4}
          align="center"
          gap={4}
          position="sticky"
          top={0}
          zIndex={10}
        >
          <Button
            display={{ base: "inline-flex", lg: "none" }}
            variant="ghost"
            onClick={() => setMobileNavOpen(true)}
            aria-label="Open navigation"
          >
            <Icon as={Menu} />
          </Button>

          <Box flex="1">
            <Heading fontSize={{ base: "md", md: "lg" }}>{activePage}</Heading>
            <Text
              color="gray.500"
              fontSize="xs"
              mt={1}
              display={{ base: "none", md: "block" }}
            >
              Admas Lottery Checker / {activePage}
            </Text>
          </Box>

          <InputGroup maxW="240px" display={{ base: "none", md: "flex" }}>
            <InputLeftElement pointerEvents="none">
              <Icon as={Search} color="gray.400" boxSize={4} />
            </InputLeftElement>
            <Input
              placeholder="Search draw code..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              bg="gray.50"
              borderColor="gray.200"
              size="sm"
            />
          </InputGroup>

          <Button
            variant="ghost"
            aria-label="Notifications"
            position="relative"
          >
            <Icon as={Bell} boxSize={5} />
          </Button>
        </Flex>

        <Box p={{ base: 4, md: 8 }} maxW="1500px" mx="auto">
          <Flex
            justify="space-between"
            align={{ base: "start", md: "center" }}
            direction={{ base: "column", md: "row" }}
            gap={4}
            mb={8}
          >
            <Box>
              <Heading size="lg" letterSpacing="-0.7px">
                {activePage === "Overview"
                  ? "Good to see you, Admin"
                  : activePage}
              </Heading>
              <Text color="gray.500" mt={2} fontSize="sm">
                {pageDescriptions[activePage]}
              </Text>
            </Box>
            <HStack>
              <Badge colorScheme="green" px={3} py={2} borderRadius="md">
                LIVE DATABASE
              </Badge>
              <Button
                bg="#111827"
                color="white"
                _hover={{ bg: "gray.700" }}
                leftIcon={<Icon as={Plus} />}
                onClick={onOpen}
              >
                New draw
              </Button>
            </HStack>
          </Flex>

          {activePage === "Overview" && (
            <>
              <Grid
                templateColumns={{
                  base: "1fr",
                  sm: "repeat(2, 1fr)",
                  xl: "repeat(4, 1fr)",
                }}
                gap={5}
              >
                <GridItem>
                  <StatCard
                    title="Registered users"
                    value={stats ? String(stats.users) : "—"}
                    description="Telegram users from /start"
                    icon={Users}
                  />
                </GridItem>
                <GridItem>
                  <StatCard
                    title="Saved tickets"
                    value={stats ? String(stats.tickets) : "—"}
                    description={
                      stats
                        ? `${stats.winners} winner${stats.winners === 1 ? "" : "s"} matched`
                        : "Live from database"
                    }
                    icon={Ticket}
                  />
                </GridItem>
                <GridItem>
                  <StatCard
                    title="Total draws"
                    value={
                      stats ? String(stats.draws.total) : String(draws.length)
                    }
                    description={
                      stats
                        ? `${stats.draws.draft} draft · ${stats.draws.verified} verified`
                        : "From database"
                    }
                    icon={CalendarDays}
                  />
                </GridItem>
                <GridItem>
                  <StatCard
                    title="Published draws"
                    value={
                      stats
                        ? String(stats.draws.published)
                        : String(
                            draws.filter((d) => d.status === "PUBLISHED")
                              .length,
                          )
                    }
                    description="Results matched & winners notified"
                    icon={Trophy}
                  />
                </GridItem>
              </Grid>

              <Grid
                templateColumns={{
                  base: "1fr",
                  xl: "minmax(0, 1.6fr) minmax(280px, 0.8fr)",
                }}
                gap={5}
                mt={7}
              >
                <GridItem>
                  <Box className="panel-card" h="100%">
                    <Flex align="center" justify="space-between" mb={5}>
                      <Box>
                        <Heading size="md">Recent draws</Heading>
                        <Text color="gray.500" fontSize="sm" mt={1}>
                          Live from the database
                        </Text>
                      </Box>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setActivePage("Draw Management")}
                        rightIcon={<Icon as={ArrowUpRight} />}
                      >
                        View all
                      </Button>
                    </Flex>
                    <DrawTable
                      draws={draws.slice(0, 4)}
                      onSelect={() => setActivePage("Draw Management")}
                      onVerify={verifyDraw}
                      onPublish={publishDraw}
                      actionLoadingId={drawActionId}
                    />
                  </Box>
                </GridItem>

                <GridItem>
                  <Box className="panel-card" h="100%">
                    <Heading size="md">Publishing workflow</Heading>
                    <Text color="gray.500" fontSize="sm" mt={1} mb={6}>
                      Keep every result accountable.
                    </Text>

                    <VStack align="stretch" spacing={5}>
                      {[
                        {
                          number: "01",
                          title: "Create a draft",
                          desc: "Enter the official draw reference and date.",
                        },
                        {
                          number: "02",
                          title: "Enter prize entries",
                          desc: "Record winning numbers and prize amounts.",
                        },
                        {
                          number: "03",
                          title: "Verify and publish",
                          desc: "Confirm against an official source first.",
                        },
                      ].map((step) => (
                        <HStack align="start" key={step.number} spacing={3}>
                          <Flex
                            w="38px"
                            h="38px"
                            flexShrink={0}
                            borderRadius="lg"
                            align="center"
                            justify="center"
                            bg="#F0F4E5"
                            color="#4A5D16"
                            fontWeight="bold"
                            fontSize="sm"
                          >
                            {step.number}
                          </Flex>
                          <Box>
                            <Text fontWeight="semibold" fontSize="sm">
                              {step.title}
                            </Text>
                            <Text
                              fontSize="xs"
                              color="gray.500"
                              mt={1}
                              lineHeight="tall"
                            >
                              {step.desc}
                            </Text>
                          </Box>
                        </HStack>
                      ))}
                    </VStack>

                    <Divider my={6} />
                    <Flex align="center" gap={2} color="gray.500">
                      <Icon as={ShieldCheck} boxSize={4} />
                      <Text fontSize="xs">
                        Publication controls will be server-authorized.
                      </Text>
                    </Flex>
                  </Box>
                </GridItem>
              </Grid>
            </>
          )}

          {activePage === "Draw Management" && (
            <Box className="panel-card">
              <Flex
                align={{ base: "start", md: "center" }}
                justify="space-between"
                gap={3}
                mb={5}
                direction={{ base: "column", md: "row" }}
              >
                <Box>
                  <Heading size="md">All draws</Heading>
                  <Text color="gray.500" fontSize="sm" mt={1}>
                    {draws.length} draws
                  </Text>
                </Box>
                <InputGroup maxW={{ base: "100%", md: "280px" }}>
                  <InputLeftElement pointerEvents="none">
                    <Icon as={Search} color="gray.400" boxSize={4} />
                  </InputLeftElement>
                  <Input
                    placeholder="Search by draw code..."
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    size="sm"
                  />
                </InputGroup>
              </Flex>
              {drawsLoading && (
                <Text color="gray.500" mb={4}>
                  Loading draws from the database...
                </Text>
              )}

              {drawsError && (
                <Text color="red.500" mb={4}>
                  {drawsError}
                </Text>
              )}
              <DrawTable
                draws={filteredDraws}
                onSelect={() => setActivePage("Prize Entries")}
                onVerify={verifyDraw}
                onPublish={publishDraw}
                actionLoadingId={drawActionId}
              />
            </Box>
          )}
          {activePage === "Prize Entries" && <PrizeEntriesPage />}
          {activePage === "Tickets" && <TicketsPage />}
          {activePage === "Users" && <UsersPage />}
          {activePage === "Payments" && <PaymentsPage />}
          {activePage === "Verification" && <VerificationPage />}
          {activePage === "Activity Logs" && <ActivityLogsPage />}
          {activePage === "Settings" && (
            <SettingsPage onLogout={() => setIsAuthenticated(false)} />
          )}

          <Text textAlign="center" color="gray.400" fontSize="xs" mt={10}>
            Admas Lottery Checker · Live admin · Synced with API
          </Text>
        </Box>
      </Box>

      <Modal isOpen={isOpen} onClose={onClose} isCentered>
        <ModalOverlay />
        <ModalContent mx={3} borderRadius="xl">
          <ModalHeader>Create a lottery draw</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Text fontSize="sm" color="gray.500" mb={5}>
              Create a draft draw record. Verify official information before
              publishing any results.
            </Text>
            <VStack spacing={4}>
              <FormControl isRequired>
                <FormLabel>Draw code</FormLabel>
                <Input
                  placeholder="e.g. DEMO-DRAW-004"
                  value={drawCode}
                  onChange={(event) => setDrawCode(event.target.value)}
                />
              </FormControl>
              <FormControl isRequired>
                <FormLabel>Draw date or official date text</FormLabel>
                <Input
                  placeholder="Enter the official date text"
                  value={drawDate}
                  onChange={(event) => setDrawDate(event.target.value)}
                />
              </FormControl>
              <FormControl>
                <FormLabel>Notes (optional)</FormLabel>
                <Textarea
                  placeholder="Reference or internal notes"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                />
              </FormControl>
            </VStack>
          </ModalBody>
          <ModalFooter gap={3}>
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button
              bg="#111827"
              color="white"
              _hover={{ bg: "gray.700" }}
              onClick={createDraw}
              isLoading={creatingDraw}
              loadingText="Saving draw..."
              isDisabled={!drawCode.trim() || !drawDate.trim()}
            >
              Create draw
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Flex>
  );
}

function DrawTable({
  draws,
  onSelect,
  onVerify,
  onPublish,
  actionLoadingId,
}: {
  draws: Draw[];
  onSelect: (draw: Draw) => void;
  onVerify: (draw: Draw) => void;
  onPublish: (draw: Draw) => void;
  actionLoadingId: string | null;
}) {
  if (draws.length === 0) {
    return (
      <Box py={12} textAlign="center">
        <Text color="gray.500">No draws match your search.</Text>
      </Box>
    );
  }

  return (
    <TableContainer>
      <Table size="sm" variant="simple">
        <Thead>
          <Tr>
            <Th>Draw code</Th>
            <Th>Date</Th>
            <Th>Status</Th>
            <Th isNumeric>Prize entries</Th>
            <Th>Actions</Th>
          </Tr>
        </Thead>
        <Tbody>
          {draws.map((draw) => (
            <Tr key={draw.id}>
              <Td fontWeight="semibold">{draw.code}</Td>
              <Td color="gray.500">{draw.date}</Td>
              <Td>
                <StatusBadge status={draw.status} />
              </Td>
              <Td isNumeric>{draw.prizes}</Td>
              <Td>
                <HStack spacing={2}>
                  <Button
                    size="xs"
                    variant="outline"
                    onClick={() => onSelect(draw)}
                  >
                    Prizes
                  </Button>
                  {draw.status === "DRAFT" && (
                    <Button
                      size="xs"
                      colorScheme="blue"
                      onClick={() => onVerify(draw)}
                      isLoading={actionLoadingId === draw.id}
                      isDisabled={draw.prizes === 0}
                    >
                      Verify
                    </Button>
                  )}
                  {draw.status === "VERIFIED" && (
                    <Button
                      size="xs"
                      colorScheme="green"
                      onClick={() => onPublish(draw)}
                      isLoading={actionLoadingId === draw.id}
                    >
                      Publish
                    </Button>
                  )}
                </HStack>
              </Td>
            </Tr>
          ))}
        </Tbody>
      </Table>
    </TableContainer>
  );
}
