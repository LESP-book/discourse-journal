# frozen_string_literal: true

module DiscourseJournal
  module PostCreatorExtension
    def valid?
      valid = super
      return false if !valid

      guardian.can_create_entry_on_topic?(@topic)
      
      end
    end
  end
end
