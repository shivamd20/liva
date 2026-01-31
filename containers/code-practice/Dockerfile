# Dockerfile for Code Practice Java Execution Environment
# Based on Cloudflare Sandbox SDK image with Java + Gson support

FROM docker.io/cloudflare/sandbox:0.7.0

# Install OpenJDK 21 and curl for downloading dependencies
RUN apt-get update && apt-get install -y \
    openjdk-21-jdk \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Set Java environment variables
ENV JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64
ENV PATH="$JAVA_HOME/bin:$PATH"

# Create libs directory and download Gson from Maven Central
# Note: The correct path is com/google/code/gson/gson (not com/google/gson)
RUN mkdir -p /opt/libs && \
    curl -fSL -o /opt/libs/gson-2.13.2.jar \
    "https://repo1.maven.org/maven2/com/google/code/gson/gson/2.13.2/gson-2.13.2.jar" && \
    test -s /opt/libs/gson-2.13.2.jar && \
    echo "Gson downloaded successfully:" && \
    ls -la /opt/libs/

# Create workspace directory for code execution
RUN mkdir -p /workspace
WORKDIR /workspace

# Verify installations
RUN java -version && javac -version && \
    echo "Testing Gson JAR:" && \
    jar tf /opt/libs/gson-2.13.2.jar | head -5
