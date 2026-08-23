import dIcon from "discourse/ui-kit/helpers/d-icon";
import { i18n } from "discourse-i18n";

export default <template>
  <div class="journal-topic-tip">
    <div class="btn btn-topic-tip" title={{i18n @details}}>
      <span class="d-button-label">{{i18n @label}}</span>
      {{dIcon "circle-info"}}
    </div>
  </div>
</template>
