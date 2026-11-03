import { useCallback, useEffect, useState } from "react";
import {
  Badge,
  Box,
  Button,
  Divider,
  Flex,
  FormControl,
  FormLabel,
  Heading,
  HStack,
  Input,
  NumberInput,
  NumberInputField,
  Spinner,
  Switch,
  Text,
  Textarea,
  VStack,
  useToast,
} from "@chakra-ui/react";
import { apiRequest } from "../lib/api";

type SettingsData = {
  admin: {
    username: string;
    authenticated: boolean;
  };
  service: {
    name: string;
    database: "connected" | "unavailable";
    botTokenConfigured: boolean;
    sessionConfigured: boolean;
  };
};

type Monetization = {
  limitsEnabled: boolean;
  freeTicketLimit: number;
  plusTicketLimit: number;
  premiumTicketLimit: number;
  plusPriceEtb: string;
  premiumPriceEtb: string;
  telebirrNumber: string;
  telebirrName: string;
  upgradeInfoAm: string | null;
  upgradeInfoEn: string | null;
};

type SettingsPageProps = {
  onLogout: () => void;
};

export default function SettingsPage({ onLogout }: SettingsPageProps) {
  const [data, setData] = useState<SettingsData | null>(null);
  const [mono, setMono] = useState<Monetization | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [loggingOut, setLoggingOut] = useState(false);
  const toast = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [settings, monetization] = await Promise.all([
        apiRequest<SettingsData>("/api/admin/settings"),
        apiRequest<{ settings: Monetization }>("/api/admin/monetization"),
      ]);
      setData(settings);
      setMono(monetization.settings);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load settings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveMonetization() {
    if (!mono) return;
    setSaving(true);
    try {
      const result = await apiRequest<{ settings: Monetization }>(
        "/api/admin/monetization",
        { method: "PUT", body: mono },
      );
      setMono(result.settings);
      toast({
        title: "Saved",
        description: mono.limitsEnabled
          ? "Ticket limits are ON"
          : "Ticket limits are OFF — everyone can save freely",
        status: "success",
        duration: 3000,
      });
    } catch (err) {
      toast({
        title: "Save failed",
        description: err instanceof Error ? err.message : "Error",
        status: "error",
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await apiRequest("/api/admin/auth/logout", { method: "POST" });
      onLogout();
    } catch (err) {
      toast({
        title: "Logout failed",
        description: err instanceof Error ? err.message : "Error",
        status: "error",
      });
    } finally {
      setLoggingOut(false);
    }
  }

  function StatusDot({ ok }: { ok: boolean }) {
    return (
      <Badge colorScheme={ok ? "green" : "red"} borderRadius="full" px={2}>
        {ok ? "OK" : "Issue"}
      </Badge>
    );
  }

  function updateMono<K extends keyof Monetization>(
    key: K,
    value: Monetization[K],
  ) {
    setMono((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  return (
    <VStack align="stretch" spacing={6}>
      {loading && (
        <Flex justify="center" py={10}>
          <Spinner />
        </Flex>
      )}
      {error && (
        <Text color="red.500" mb={2}>
          {error}
        </Text>
      )}

      {mono && !loading && (
        <Box className="panel-card">
          <Flex justify="space-between" align="center" mb={4}>
            <Box>
              <Heading size="md">Monetization & ticket limits</Heading>
              <Text color="gray.500" fontSize="sm" mt={1}>
                Turn limits on/off anytime. Set free / plus / premium caps and
                Telebirr details.
              </Text>
            </Box>
            <HStack>
              <Text fontSize="sm" fontWeight="medium">
                Limits {mono.limitsEnabled ? "ON" : "OFF"}
              </Text>
              <Switch
                colorScheme="green"
                isChecked={mono.limitsEnabled}
                onChange={(e) => updateMono("limitsEnabled", e.target.checked)}
              />
            </HStack>
          </Flex>

          <Box
            mb={5}
            p={4}
            borderRadius="lg"
            bg={mono.limitsEnabled ? "green.50" : "gray.50"}
            borderWidth="1px"
            borderColor={mono.limitsEnabled ? "green.200" : "gray.200"}
          >
            <Text fontSize="sm" color="gray.700">
              {mono.limitsEnabled
                ? "Limits are active. Users cannot save more tickets than their plan allows."
                : "Limits are disabled. Everyone can save unlimited tickets until you turn this on."}
            </Text>
          </Box>

          <HStack spacing={6} align="start" flexWrap="wrap" mb={5}>
            <FormControl maxW="140px">
              <FormLabel fontSize="sm">Free limit</FormLabel>
              <NumberInput
                size="sm"
                min={0}
                value={mono.freeTicketLimit}
                onChange={(_, n) =>
                  updateMono("freeTicketLimit", Number.isFinite(n) ? n : 0)
                }
              >
                <NumberInputField />
              </NumberInput>
            </FormControl>
            <FormControl maxW="140px">
              <FormLabel fontSize="sm">Plus limit</FormLabel>
              <NumberInput
                size="sm"
                min={0}
                value={mono.plusTicketLimit}
                onChange={(_, n) =>
                  updateMono("plusTicketLimit", Number.isFinite(n) ? n : 0)
                }
              >
                <NumberInputField />
              </NumberInput>
            </FormControl>
            <FormControl maxW="140px">
              <FormLabel fontSize="sm">Premium limit</FormLabel>
              <NumberInput
                size="sm"
                min={0}
                value={mono.premiumTicketLimit}
                onChange={(_, n) =>
                  updateMono("premiumTicketLimit", Number.isFinite(n) ? n : 0)
                }
              >
                <NumberInputField />
              </NumberInput>
            </FormControl>
            <FormControl maxW="140px">
              <FormLabel fontSize="sm">Plus price (ETB)</FormLabel>
              <Input
                size="sm"
                value={mono.plusPriceEtb}
                onChange={(e) => updateMono("plusPriceEtb", e.target.value)}
              />
            </FormControl>
            <FormControl maxW="140px">
              <FormLabel fontSize="sm">Premium price (ETB)</FormLabel>
              <Input
                size="sm"
                value={mono.premiumPriceEtb}
                onChange={(e) => updateMono("premiumPriceEtb", e.target.value)}
              />
            </FormControl>
          </HStack>

          <HStack spacing={4} mb={5} flexWrap="wrap">
            <FormControl maxW="220px">
              <FormLabel fontSize="sm">Telebirr number</FormLabel>
              <Input
                size="sm"
                placeholder="09xxxxxxxx"
                value={mono.telebirrNumber}
                onChange={(e) => updateMono("telebirrNumber", e.target.value)}
              />
            </FormControl>
            <FormControl maxW="220px">
              <FormLabel fontSize="sm">Account name</FormLabel>
              <Input
                size="sm"
                placeholder="Your name"
                value={mono.telebirrName}
                onChange={(e) => updateMono("telebirrName", e.target.value)}
              />
            </FormControl>
          </HStack>

          <FormControl mb={3}>
            <FormLabel fontSize="sm">Upgrade info (Amharic)</FormLabel>
            <Textarea
              size="sm"
              rows={2}
              value={mono.upgradeInfoAm ?? ""}
              onChange={(e) => updateMono("upgradeInfoAm", e.target.value)}
              placeholder="Optional message shown to users"
            />
          </FormControl>
          <FormControl mb={5}>
            <FormLabel fontSize="sm">Upgrade info (English)</FormLabel>
            <Textarea
              size="sm"
              rows={2}
              value={mono.upgradeInfoEn ?? ""}
              onChange={(e) => updateMono("upgradeInfoEn", e.target.value)}
              placeholder="Optional message shown to users"
            />
          </FormControl>

          <Button
            bg="#111827"
            color="white"
            _hover={{ bg: "gray.700" }}
            size="sm"
            onClick={() => void saveMonetization()}
            isLoading={saving}
          >
            Save monetization settings
          </Button>
        </Box>
      )}

      {data && !loading && (
        <Box className="panel-card">
          <Heading size="md" mb={1}>
            Session & health
          </Heading>
          <Text color="gray.500" fontSize="sm" mb={6}>
            Admin session and service status
          </Text>

          <VStack align="stretch" spacing={4}>
            <HStack justify="space-between">
              <Text fontSize="sm">Username</Text>
              <Text fontWeight="semibold">{data.admin.username}</Text>
            </HStack>
            <HStack justify="space-between">
              <Text fontSize="sm">Database</Text>
              <StatusDot ok={data.service.database === "connected"} />
            </HStack>
            <HStack justify="space-between">
              <Text fontSize="sm">Bot token</Text>
              <StatusDot ok={data.service.botTokenConfigured} />
            </HStack>

            <Divider />

            <HStack>
              <Button size="sm" variant="outline" onClick={() => void load()}>
                Refresh
              </Button>
              <Button
                size="sm"
                colorScheme="red"
                variant="outline"
                onClick={() => void handleLogout()}
                isLoading={loggingOut}
              >
                Log out
              </Button>
            </HStack>
          </VStack>
        </Box>
      )}
    </VStack>
  );
}
