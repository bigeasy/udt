#ifndef WIN32
   #include <arpa/inet.h>
   #include <netdb.h>
#else
   #include <winsock2.h>
   #include <ws2tcpip.h>
#endif
#include <fstream>
#include <iostream>
#include <cstdlib>
#include <cstring>
#include <udt.h>

using namespace std;

int main(int argc, char* argv[])
{
   if ((argc != 3) || (0 == atoi(argv[2])))
   {
      cout << "usage: client server_ip server_port" << endl;
      return -1;
   }

   // use this function to initialize the UDT library
   UDT::startup();

   struct addrinfo hints, *peer;
   memset(&hints, 0, sizeof(struct addrinfo));
   hints.ai_flags = AI_PASSIVE;
   hints.ai_family = AF_INET;
   hints.ai_socktype = SOCK_STREAM;


   UDTSOCKET fhandle = UDT::socket(hints.ai_family, hints.ai_socktype, hints.ai_protocol);

   if (0 != getaddrinfo(argv[1], argv[2], &hints, &peer))
   {
      cout << "incorrect server/peer address. " << argv[1] << ":" << argv[2] << endl;
      return -1;
   }

   // connect to the server, implict bind
   if (UDT::ERROR == UDT::connect(fhandle, peer->ai_addr, peer->ai_addrlen))
   {
      cout << "connect: " << UDT::getlasterror().getErrorMessage() << endl;
      return -1;
   }

   freeaddrinfo(peer);


   UDT::close(fhandle);

   // use this function to release the UDT library
   UDT::cleanup();

   return 0;
}
