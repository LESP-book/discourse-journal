import JournalTopicTip from "../../components/journal-topic-tip";

export default <template>
  {{#if @outletArgs.topic.showJournalTip}}
    <JournalTopicTip
      @label="topic.tip.journal.title"
      @details="topic.tip.journal.details"
    />
  {{/if}}
</template>
