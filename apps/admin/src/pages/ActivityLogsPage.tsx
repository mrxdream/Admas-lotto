import { useCallback, useEffect, useState } from "react";
import {
  Badge,
  Box,
  Button,
  Flex,
  Heading,
  Spinner,
  Text,
  VStack,
} from "@chakra-ui/react";
import { apiRequest } from "../lib/api";

type ActivityItem = {
  id: string;
  type:
    | "ticket_saved"
    | "winner"
    | "draw_created"
    | "draw_verified"
    | "draw_published";
  title: string;
  detail: string;
  at: string;
};

const typeStyles: Record<
  ActivityItem["type"],
  { color: string; label: string }
> = {
  ticket_saved: { color: "purple", label: "Ticket" },
  winner: { color: "green", label: "Winner" },
  draw_created: { color: "gray", label: "Draw" },
  draw_verified: { color: "blue", label: "Verified" },
  draw_published: { color: "teal", label: "Published" },
};

export default function ActivityLogsPage() {
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await apiRequest<{ activity: ActivityItem[] }>(
        "/api/admin/activity?limit=50",
      );
      setItems(data.activity);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load activity");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <Box className="panel-card">
      <Flex justify="space-between" align="center" mb={5}>
        <Box>
          <Heading size="md">Activity</Heading>
          <Text color="gray.500" fontSize="sm" mt={1}>
            Live feed from tickets, winners, and draw status changes
          </Text>
        </Box>
        <Button size="sm" variant="outline" onClick={() => void load()}>
          Refresh
        </Button>
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

      {!loading && items.length === 0 && (
        <Text color="gray.500" textAlign="center" py={10}>
          No activity yet. Save a ticket or create a draw to see events here.
        </Text>
      )}

      <VStack align="stretch" spacing={3}>
        {items.map((item) => {
          const style = typeStyles[item.type];
          return (
            <Flex
              key={item.id}
              gap={4}
              p={4}
              bg="gray.50"
              borderRadius="lg"
              borderWidth="1px"
              borderColor="gray.100"
              align="start"
            >
              <Badge
                colorScheme={style.color}
                borderRadius="full"
                px={2}
                mt={0.5}
                flexShrink={0}
              >
                {style.label}
              </Badge>
              <Box flex="1" minW={0}>
                <Text fontWeight="semibold" fontSize="sm">
                  {item.title}
                </Text>
                <Text color="gray.600" fontSize="sm" mt={0.5}>
                  {item.detail}
                </Text>
              </Box>
              <Text
                fontSize="xs"
                color="gray.400"
                whiteSpace="nowrap"
                flexShrink={0}
              >
                {new Date(item.at).toLocaleString()}
              </Text>
            </Flex>
          );
        })}
      </VStack>
    </Box>
  );
}
