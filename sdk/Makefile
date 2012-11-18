C++ = g++

ifndef os
   os = LINUX
endif

ifndef arch
   arch = IA32
endif

CCFLAGS = -Wall -D$(os) -I$(sdk) -finline-functions -O3

ifeq ($(arch), IA32)
   CCFLAGS += -DIA32 #-mcpu=pentiumpro -march=pentiumpro -mmmx -msse
endif

ifeq ($(arch), POWERPC)
   CCFLAGS += -mcpu=powerpc
endif

ifeq ($(arch), IA64)
   CCFLAGS += -DIA64
endif

ifeq ($(arch), SPARC)
   CCFLAGS += -DSPARC
endif

LDFLAGS = -L$(sdk) -ludt -lstdc++ -lpthread -lm

ifeq ($(os), UNIX)
   LDFLAGS += -lsocket
endif

ifeq ($(os), SUNOS)
   LDFLAGS += -lrt -lsocket
endif

DIR = $(shell pwd)

APP = file/client file/server connect/client integer/client integer/server

all: $(APP)

%.o: %.cpp
	$(C++) $(CCFLAGS) $< -c -o $@

file/server: file/server.o
	$(C++) $^ -o $@ $(LDFLAGS)
file/client: file/client.o
	$(C++) $^ -o $@ $(LDFLAGS)
connect/client: connect/client.o
	$(C++) $^ -o $@ $(LDFLAGS)
integer/server: integer/server.o
	$(C++) $^ -o $@ $(LDFLAGS)
integer/client: integer/client.o
	$(C++) $^ -o $@ $(LDFLAGS)

clean:
	rm -f */*.o $(APP)

install:
	export PATH=$(DIR):$$PATH
