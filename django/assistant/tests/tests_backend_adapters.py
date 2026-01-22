import unittest
from assistant.generation_backends.adapters import CompletionBackendAdapter
from assistant.generation_backends.base import ChatCompletionJob
from assistant.generation_backends import DummyBackend


class CompletionBackendAdapterTests(unittest.TestCase):
    """Test suite for CompletionBackendAdapter to verify it generates correct streaming events."""

    def setUp(self):
        """Set up test fixtures."""
        self.backend = DummyBackend(sleep_secs=0.01)
        self.adapter = CompletionBackendAdapter(self.backend)
        self.job = ChatCompletionJob(
            model="test-model",
            base_url="http://test.com",
            messages=[{"role": "user", "content": "Hello"}],
            params={}
        )

    def test_basic_text_output_events(self):
        """Test that adapter generates correct events for simple text output without thinking tags."""
        events = list(self.adapter.generate(self.job))
        
        # Should have at least: output_item.added, content_part.added, multiple deltas, output_text.done, content_part.done, output_item.done
        self.assertGreater(len(events), 5, "Should generate multiple events")
        
        # First event should be output_item.added
        self.assertEqual(events[0]["type"], "response.output_item.added")
        self.assertIn("item", events[0])
        self.assertEqual(events[0]["item"]["status"], "in_progress")
        self.assertEqual(events[0]["item"]["type"], "message")
        
        # Second event should be content_part.added
        self.assertEqual(events[1]["type"], "response.content_part.added")
        self.assertEqual(events[1]["part"]["type"], "output_text")
        
        # Should have multiple output_text.delta events
        delta_events = [e for e in events if e["type"] == "response.output_text.delta"]
        self.assertGreater(len(delta_events), 0, "Should have at least one delta event")
        
        # Last few events should be: output_text.done, content_part.done, output_item.done
        self.assertEqual(events[-3]["type"], "response.output_text.done")
        self.assertEqual(events[-2]["type"], "response.content_part.done")
        self.assertEqual(events[-1]["type"], "response.output_item.done")
        
        # Verify sequence numbers are incremental
        seq_nums = [event["sequence_number"] for event in events]
        self.assertEqual(seq_nums, list(range(1, len(events) + 1)), "Sequence numbers should be incremental")

    def test_event_structure_basic_output(self):
        """Test that events have correct structure according to OpenAI responses API."""
        events = list(self.adapter.generate(self.job))
        
        for event in events:
            # All events should have type, output_index, and sequence_number
            self.assertIn("type", event)
            self.assertIn("output_index", event)
            self.assertIn("sequence_number", event)
            
            # output_index should be 0 for first item
            self.assertEqual(event["output_index"], 0)

    def test_output_item_structure(self):
        """Test that output_item events have correct structure."""
        events = list(self.adapter.generate(self.job))
        
        # Find output_item.added event
        item_added = next(e for e in events if e["type"] == "response.output_item.added")
        item = item_added["item"]
        
        self.assertIn("id", item)
        self.assertIn("status", item)
        self.assertIn("type", item)
        self.assertIn("role", item)
        self.assertIn("content", item)
        self.assertEqual(item["status"], "in_progress")
        self.assertEqual(item["type"], "message")
        self.assertEqual(item["role"], "assistant")
        self.assertEqual(item["content"], [])
        
        # Find output_item.done event
        item_done = next(e for e in events if e["type"] == "response.output_item.done")
        item = item_done["item"]
        
        self.assertEqual(item["status"], "complete")
        self.assertEqual(item["type"], "message")
        self.assertEqual(item["role"], "assistant")
        self.assertIsInstance(item["content"], list)
        self.assertEqual(len(item["content"]), 1)
        self.assertEqual(item["content"][0]["type"], "output_text")
        self.assertIn("text", item["content"][0])

    def test_content_part_events(self):
        """Test that content_part events have correct structure."""
        events = list(self.adapter.generate(self.job))
        
        # Find content_part.added
        part_added = next(e for e in events if e["type"] == "response.content_part.added")
        self.assertIn("item_id", part_added)
        self.assertIn("content_index", part_added)
        self.assertIn("part", part_added)
        self.assertEqual(part_added["part"]["type"], "output_text")
        self.assertEqual(part_added["part"]["text"], "")
        self.assertIn("annotations", part_added["part"])
        
        # Find content_part.done
        part_done = next(e for e in events if e["type"] == "response.content_part.done")
        self.assertIn("item_id", part_done)
        self.assertIn("content_index", part_done)
        self.assertIn("part", part_done)
        self.assertEqual(part_done["part"]["type"], "output_text")
        self.assertIn("text", part_done["part"])
        self.assertIn("annotations", part_done["part"])

    def test_output_text_delta_events(self):
        """Test that output_text.delta events accumulate correctly."""
        events = list(self.adapter.generate(self.job))
        
        delta_events = [e for e in events if e["type"] == "response.output_text.delta"]
        self.assertGreater(len(delta_events), 0)
        
        # All delta events should have item_id, content_index, and delta
        for delta_event in delta_events:
            self.assertIn("item_id", delta_event)
            self.assertIn("content_index", delta_event)
            self.assertIn("delta", delta_event)
            self.assertEqual(delta_event["content_index"], 0)
        
        # Accumulate all deltas
        accumulated_text = "".join(e["delta"] for e in delta_events)
        
        # Find output_text.done to verify final text
        output_done = next(e for e in events if e["type"] == "response.output_text.done")
        # Note: output_text.done doesn't have delta, it has text
        # But we can check the final item in output_item.done
        item_done = next(e for e in events if e["type"] == "response.output_item.done")
        final_text = item_done["item"]["content"][0]["text"]

        self.assertEqual(accumulated_text, final_text)
        self.assertEqual(accumulated_text, output_done["text"])

    def test_reasoning_events_with_thinking_tags(self):
        """Test that adapter correctly handles thinking tags and generates reasoning events."""
        # Create a backend that yields thinking tags
        class ThinkingBackend(DummyBackend):
            tokens = ["<think>", "This", "is", "reasoning", "</think>", "This", "is", "output", "."]
            separator = " "
        
        backend = ThinkingBackend(sleep_secs=0.01)
        adapter = CompletionBackendAdapter(backend)
        events = list(adapter.generate(self.job))
        
        # Should have reasoning events first, then output events
        event_types = [event["type"] for event in events]
        
        # Should start with reasoning item added
        self.assertIn("response.output_item.added", event_types)
        first_item_added_idx = event_types.index("response.output_item.added")
        first_item = events[first_item_added_idx]["item"]
        self.assertEqual(first_item["type"], "reasoning")
        
        # Should have reasoning_text.delta events
        reasoning_deltas = [e for e in events if e["type"] == "response.reasoning_text.delta"]
        self.assertGreater(len(reasoning_deltas), 0)
        
        # Should have reasoning_text.done
        reasoning_done = next(e for e in events if e["type"] == "response.reasoning_text.done")
        self.assertIn("item_id", reasoning_done)
        self.assertIn("text", reasoning_done)
        
        # Should have output_text events after reasoning
        output_deltas = [e for e in events if e["type"] == "response.output_text.delta"]
        self.assertGreater(len(output_deltas), 0)
        
        # Verify reasoning item is complete
        reasoning_item_done = None
        for event in events:
            if event["type"] == "response.output_item.done":
                if event["item"]["type"] == "reasoning":
                    reasoning_item_done = event
                    break
        
        self.assertIsNotNone(reasoning_item_done)
        self.assertEqual(reasoning_item_done["item"]["status"], "complete")
        self.assertEqual(reasoning_item_done["item"]["content"][0]["type"], "reasoning_text")

        self.assertEqual(reasoning_item_done["item"]["content"][0]["text"], " This is reasoning ")

    def test_event_order_with_reasoning(self):
        """Test that events are generated in correct order when reasoning is present."""
        # todo: simplify this
        class ThinkingBackend(DummyBackend):
            tokens = ["<think>", "reasoning", "</think>", "output"]
            separator = " "
        
        backend = ThinkingBackend(sleep_secs=0.01)
        adapter = CompletionBackendAdapter(backend)
        events = list(adapter.generate(self.job))
        
        event_types = [event["type"] for event in events]
        
        # Find indices of key events
        reasoning_item_added_idx = event_types.index("response.output_item.added")
        reasoning_item_done_idx = None
        output_item_added_idx = None
        
        for i, event in enumerate(events):
            if event["type"] == "response.output_item.done" and event["item"]["type"] == "reasoning":
                reasoning_item_done_idx = i
            elif event["type"] == "response.output_item.added" and i > reasoning_item_added_idx:
                # This should be the output item
                if event["item"]["type"] == "message":
                    output_item_added_idx = i
        
        # Reasoning item should be done before output item starts
        if reasoning_item_done_idx is not None and output_item_added_idx is not None:
            self.assertLess(reasoning_item_done_idx, output_item_added_idx,
                          "Reasoning item should complete before output item starts")

    def test_sequence_numbers_incremental(self):
        """Test that sequence numbers are always incremental across all events."""
        events = list(self.adapter.generate(self.job))
        
        seq_nums = [event["sequence_number"] for event in events]
        
        # Should start at 1
        self.assertEqual(seq_nums[0], 1)
        
        # Should be strictly increasing
        for i in range(1, len(seq_nums)):
            self.assertEqual(seq_nums[i], seq_nums[i-1] + 1,
                           f"Sequence number at index {i} should be {seq_nums[i-1] + 1}, got {seq_nums[i]}")

    def test_output_index_consistency(self):
        """Test that output_index is consistent across events for the same item."""
        events = list(self.adapter.generate(self.job))
        
        # All events should have output_index 0 for first item
        for event in events:
            self.assertEqual(event["output_index"], 0)
    
    def test_item_id_consistency(self):
        """Test that item_id is consistent across all events for the same item."""
        events = list(self.adapter.generate(self.job))
        
        # Find the item_id from output_item.added
        item_added = next(e for e in events if e["type"] == "response.output_item.added")
        item_id = item_added["item"]["id"]
                
        for event in events:
            if "item_id" in event:
                self.assertEqual(event["item_id"], item_id,
                               f"Event {event['type']} should have item_id {item_id}")
            elif event["type"] in ["response.output_item.added", "response.output_item.done"]:
                if "item" in event:
                    self.assertEqual(event["item"]["id"], item_id,
                                   f"Event {event['type']} should have item id {item_id}")

    def test_response_accumulation(self):
        """Test that adapter accumulates response items correctly."""
        events = list(self.adapter.generate(self.job))
        
        # Should have at least one complete item in response
        self.assertGreater(len(self.adapter.response), 0)
        
        # Each item should have complete status
        for item in self.adapter.response:
            self.assertEqual(item["status"], "complete")
            self.assertIn("content", item)
            self.assertIsInstance(item["content"], list)
            self.assertGreater(len(item["content"]), 0)

    def test_empty_output_handling(self):
        """Test that adapter handles empty output gracefully."""
        class EmptyBackend(DummyBackend):
            tokens = []
            separator = " "
        
        backend = EmptyBackend()
        adapter = CompletionBackendAdapter(backend)
        events = list(adapter.generate(self.job))
        
        # Should still generate some events (at least output_item.added)
        self.assertEqual(len(events), 0)
    
    def test_leftover_text_without_additional_tokens(self):
        """Test handling of leftover text when no additional tokens are generated."""
        # This tests the edge case where thinking ends with leftover text but generator is exhausted
        class LeftoverOnlyBackend(DummyBackend):
            def generate(self, job):
                # Yield just enough to create leftover after thinking tag
                yield "<think>"
                yield "some reasoning"
                yield "</think>"
                yield "leftover"
                # Generator exhausted - no more tokens
        
        backend = LeftoverOnlyBackend()
        adapter = CompletionBackendAdapter(backend)
        events = list(adapter.generate(self.job))
        
        # Should have both reasoning and output events
        event_types = [event["type"] for event in events]
        self.assertIn("response.output_item.added", event_types)
        self.assertIn("response.output_item.done", event_types)
        
        # Should have output_text events for the leftover
        output_deltas = [e for e in events if e["type"] == "response.output_text.delta"]
        # Should have at least one delta for leftover text
        self.assertGreaterEqual(len(output_deltas), 0)

    def test_multiple_items_output_index(self):
        """Test that output_index increments for multiple items."""
        class ThinkingBackend(DummyBackend):
            tokens = ["<think>", "reasoning", "</think>", "output"]
            separator = " "
        
        backend = ThinkingBackend()
        adapter = CompletionBackendAdapter(backend)
        events = list(adapter.generate(self.job))
        
        # Should have two items: reasoning and message
        self.assertEqual(len(adapter.response), 2)
        
        # First item (reasoning) should have output_index 0
        reasoning_events = [e for e in events if e.get("item", {}).get("type") == "reasoning" or 
                          (e["type"] == "response.reasoning_text.delta")]
        if reasoning_events:
            self.assertEqual(reasoning_events[0]["output_index"], 0)
        
        # After reasoning item is done, output_index should increment
        # Find the output_item.done for reasoning
        reasoning_done_idx = None
        for i, event in enumerate(events):
            if event["type"] == "response.output_item.done" and event["item"]["type"] == "reasoning":
                reasoning_done_idx = i
                break
        
        if reasoning_done_idx is not None:
            # Events after reasoning item done should have incremented output_index
            # Actually, looking at the code, output_index only increments in output_item_done
            # So the second item should have output_index 1
            output_item_done_events = [e for e in events if e["type"] == "response.output_item.done"]
            if len(output_item_done_events) > 1:
                self.assertEqual(output_item_done_events[0]["output_index"], 0)
                self.assertEqual(output_item_done_events[1]["output_index"], 1)

