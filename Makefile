# Programs
TSC := tsc
SEVENZIP := 7z

RM_CP := cp --remove-destination
RM_LN := cp --remove-destination --symbolic-link

# Archive basename
NAME := duplicate-tabs-closer

# File lists
FILES := \
	README.md \
	LICENSE \
	_locales \
	ext_lib \
	images \
	optionPage \
	popup \
	helper.js \
	messageListener.js \
	options.js \

SOURCE := \
	tracker.ts \
	badge.ts \
	worker.ts \
	background.ts

GENERATED := \
	$(SOURCE:.ts=.js) \
	$(SOURCE:.ts=.js.map)

ALL_FILES := \
	$(FILES) \
	$(SOURCE) \
	$(GENERATED)

# Toplevel rules
ALL_ARCHIVES := \
	$(NAME).xpi \
	$(NAME).crx

.PHONY: all compile
all: $(ALL_ARCHIVES) # Build all extension archives
compile: $(GENERATED) # Only compile TypeScript

# Browsers
$(NAME).xpi: manifest-firefox.json $(ALL_FILES) # Firefox
$(NAME).crx: manifest-chrome.json $(ALL_FILES) # Chrome

.PHONY: firefox chrome
firefox: $(NAME).xpi
chrome: $(NAME).crx

# Generic Rules
%.js %.js.map: %.ts
	$(TSC)

$(ALL_ARCHIVES):
	$(RM_CP) $< manifest.json
	[ -f $@ ] && rm $@
	$(SEVENZIP) a -tzip $@ manifest.json $(ALL_FILES)

# Dev rules: Prepare directory for loading extension in dev mode
.PHONY: dev-%
dev-%: manifest-%.json $(GENERATED)
	$(RM_LN) $< manifest.json

# Clean
CLEAN_FILES := \
	manifest.json \
	$(GENERATED) \
	$(ALL_ARCHIVES)

TO_CLEAN_FILES := $(strip $(foreach f,$(CLEAN_FILES),$(wildcard $(f))))

.PHONY: Clean
clean:
ifneq ($(TO_CLEAN_FILES),)
	rm -f $(TO_CLEAN_FILES)
endif
