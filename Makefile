sources = $(wildcard sdk/*/*.cpp)
targets = $(sources:%.cpp=%)
sdk = build/udt4/src

UNAME := $(shell uname)

ifeq ($(UNAME), Darwin)
	LIBUDT = libudt.dylib
	OS = OSX
else
	LIBUDT = libudt.so
	OS = Linux
endif

LDFLAGS = -L$(sdk) -ludt -lstdc++ -lpthread -lm
CCFLAGS = -Wall -D$(OS) -I$(sdk) -finline-functions -O3

all: $(targets)

$(targets): %: %.cpp build/udt4/src/$(LIBUDT)
	gcc $< -o $@ $(LDFLAGS) $(CCFLAGS)

build/udt4/src/$(LIBUDT): build/udt4/Makefile
	make -e os=$(OS) -C build/udt4

build/udt4/Makefile: build/udt.sdk.4.10.tar.gz
	tar -C build -zxf $<
	touch $@

build/udt.sdk.4.10.tar.gz:
	@mkdir -p build
	curl -Ls http://downloads.sourceforge.net/project/udt/udt/4.10/udt.sdk.4.10.tar.gz > $@.tmp
	[ "$$(cat $@.tmp | $$(which md5sum || which md5) | cut -f1 -d' ')" = "6bb2d8454d67c920eb446fddb7d030c4" ] && mv $@.tmp $@

clean:
	rm -rf build
